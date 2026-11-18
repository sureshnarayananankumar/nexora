package com.nexora.insights;

import com.fasterxml.jackson.databind.ObjectMapper;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.stereotype.Component;

import java.time.Duration;
import java.util.function.Supplier;

/**
 * 60-second Redis cache for computed project health. Explicit JSON (de)serialisation keeps it
 * type-safe; any Redis failure falls back to computing directly.
 */
@Component
public class InsightsCache {

    private static final Logger log = LoggerFactory.getLogger(InsightsCache.class);
    private static final Duration TTL = Duration.ofSeconds(60);

    private final StringRedisTemplate redis;
    private final ObjectMapper mapper;

    public InsightsCache(StringRedisTemplate redis, ObjectMapper mapper) {
        this.redis = redis;
        this.mapper = mapper;
    }

    private static String key(Long projectId) {
        return "nexora:insights:health:" + projectId;
    }

    public HealthCalculator.HealthReport health(Long projectId, Supplier<HealthCalculator.HealthReport> compute) {
        try {
            String cached = redis.opsForValue().get(key(projectId));
            if (cached != null) return mapper.readValue(cached, HealthCalculator.HealthReport.class);
        } catch (Exception e) {
            log.debug("Insights cache read skipped: {}", e.getMessage());
        }
        HealthCalculator.HealthReport report = compute.get();
        try {
            redis.opsForValue().set(key(projectId), mapper.writeValueAsString(report), TTL);
        } catch (Exception e) {
            log.debug("Insights cache write skipped: {}", e.getMessage());
        }
        return report;
    }

    public void evict(Long projectId) {
        try {
            redis.delete(key(projectId));
        } catch (Exception e) {
            log.debug("Insights cache evict skipped: {}", e.getMessage());
        }
    }
}
