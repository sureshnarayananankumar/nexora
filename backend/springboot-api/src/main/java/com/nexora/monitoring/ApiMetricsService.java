package com.nexora.monitoring;

import com.nexora.settings.SettingsService;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;

import java.sql.Timestamp;
import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.*;
import java.util.concurrent.ConcurrentLinkedQueue;
import java.util.concurrent.atomic.AtomicInteger;

@Service
public class ApiMetricsService {

    private static final Logger log = LoggerFactory.getLogger(ApiMetricsService.class);
    private static final int MAX_BUFFER = 20_000;

    private record Sample(String method, String path, int status, int ms, Long userId, Instant at) {
    }

    private final ConcurrentLinkedQueue<Sample> buffer = new ConcurrentLinkedQueue<>();
    private final AtomicInteger size = new AtomicInteger();
    private final JdbcTemplate jdbc;
    private final SettingsService settings;

    public ApiMetricsService(JdbcTemplate jdbc, SettingsService settings) {
        this.jdbc = jdbc;
        this.settings = settings;
    }

    public void record(String method, String path, int status, int ms, Long userId) {
        if (size.get() >= MAX_BUFFER) return; // shed load rather than run out of memory
        buffer.add(new Sample(method, path, status, ms, userId, Instant.now()));
        size.incrementAndGet();
    }

    @Scheduled(fixedDelay = 5_000)
    public void flush() {
        List<Object[]> batch = new ArrayList<>();
        Sample s;
        while (batch.size() < 2_000 && (s = buffer.poll()) != null) {
            size.decrementAndGet();
            batch.add(new Object[]{s.method(), s.path(), s.status(), s.ms(), s.userId(), Timestamp.from(s.at())});
        }
        if (batch.isEmpty()) return;
        try {
            jdbc.batchUpdate("INSERT INTO api_request_logs (method, path, status_code, duration_ms, user_id, created_at) VALUES (?,?,?,?,?,?)", batch);
        } catch (RuntimeException e) {
            log.warn("Could not store {} API metrics: {}", batch.size(), e.getMessage());
        }
    }

    @Scheduled(cron = "0 15 2 * * *", zone = "UTC")
    public void purge() {
        int days = settings.integer(SettingsService.API_LOG_RETENTION, 7);
        jdbc.update("DELETE FROM api_request_logs WHERE created_at < ?",
                Timestamp.from(Instant.now().minus(days, ChronoUnit.DAYS)));
    }

    public record EndpointStat(String method, String path, long requests, long errors, double errorRate, int avgMs, int p95Ms) {
    }

    public record HourPoint(String hour, long requests, long errors, int avgMs) {
    }

    public record Summary(long requests, long errors, double errorRate, int avgMs, int p95Ms, List<HourPoint> hourly,
                          List<EndpointStat> endpoints, List<EndpointStat> slowest) {
    }

    /** Aggregates the last N hours. p95 is computed in memory per endpoint (bounded by the window). */
    public Summary summary(int hours) {
        int h = Math.max(1, Math.min(hours, 168));
        Timestamp since = Timestamp.from(Instant.now().minus(h, ChronoUnit.HOURS));
        Map<String, List<Integer>> durations = new HashMap<>();
        Map<String, long[]> counts = new HashMap<>();
        List<Integer> all = new ArrayList<>();
        long[] errors = {0};
        jdbc.query("SELECT method, path, status_code, duration_ms FROM api_request_logs WHERE created_at >= ? LIMIT 200000",
                rs -> {
                    String key = rs.getString(1) + " " + rs.getString(2);
                    int ms = rs.getInt(4);
                    boolean err = rs.getInt(3) >= 500;
                    durations.computeIfAbsent(key, k -> new ArrayList<>()).add(ms);
                    long[] c = counts.computeIfAbsent(key, k -> new long[2]);
                    c[0]++;
                    if (err) { c[1]++; errors[0]++; }
                    all.add(ms);
                }, since);

        List<EndpointStat> endpoints = new ArrayList<>();
        durations.forEach((key, list) -> {
            long[] c = counts.get(key);
            String[] parts = key.split(" ", 2);
            endpoints.add(new EndpointStat(parts[0], parts[1], c[0], c[1], pct(c[1], c[0]), avg(list), p95(list)));
        });
        endpoints.sort(Comparator.comparingLong(EndpointStat::requests).reversed());
        List<EndpointStat> slowest = endpoints.stream().filter(e -> e.requests() >= 3)
                .sorted(Comparator.comparingInt(EndpointStat::p95Ms).reversed()).limit(8).toList();

        List<HourPoint> hourly = jdbc.query("""
                SELECT DATE_FORMAT(created_at, '%Y-%m-%dT%H:00') AS hr, COUNT(*) AS n,
                       SUM(CASE WHEN status_code >= 500 THEN 1 ELSE 0 END) AS err, ROUND(AVG(duration_ms)) AS avg_ms
                FROM api_request_logs WHERE created_at >= ?
                GROUP BY hr ORDER BY hr
                """, (rs, i) -> new HourPoint(rs.getString("hr"), rs.getLong("n"), rs.getLong("err"), rs.getInt("avg_ms")), since);

        return new Summary(all.size(), errors[0], pct(errors[0], all.size()), avg(all), p95(all), hourly,
                endpoints.stream().limit(25).toList(), slowest);
    }

    static int p95(List<Integer> values) {
        if (values.isEmpty()) return 0;
        List<Integer> sorted = new ArrayList<>(values);
        Collections.sort(sorted);
        int idx = (int) Math.ceil(0.95 * sorted.size()) - 1;
        return sorted.get(Math.max(0, Math.min(idx, sorted.size() - 1)));
    }

    private static int avg(List<Integer> values) {
        return values.isEmpty() ? 0 : (int) Math.round(values.stream().mapToInt(Integer::intValue).average().orElse(0));
    }

    private static double pct(long part, long total) {
        return total == 0 ? 0 : Math.round(part * 1000.0 / total) / 10.0;
    }
}
