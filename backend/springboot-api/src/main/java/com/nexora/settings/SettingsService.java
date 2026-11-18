package com.nexora.settings;

import com.nexora.audit.AuditService;
import com.nexora.common.ApiException;
import com.nexora.common.Jsons;
import com.nexora.security.CurrentUser;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.util.List;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;

/** Platform settings that change runtime behaviour. Cached in memory for 30 s. */
@Service
public class SettingsService {

    public static final String REGISTRATION_ENABLED = "registration.enabled";
    public static final String ANNOUNCEMENT = "announcement.banner";
    public static final String STALE_DAYS = "insights.stale_days";
    public static final String WORKFLOW_MAX_STEPS = "workflow.max_steps";
    public static final String API_LOG_RETENTION = "api_logs.retention_days";

    private final SystemSettingRepository repo;
    private final AuditService audit;
    private final Map<String, String> cache = new ConcurrentHashMap<>();
    private volatile Instant loadedAt = Instant.EPOCH;

    public SettingsService(SystemSettingRepository repo, AuditService audit) {
        this.repo = repo;
        this.audit = audit;
    }

    public record SettingDto(String key, String value, String valueType, String description, String updatedBy,
                             Instant updatedAt) {
        static SettingDto of(SystemSetting s) {
            return new SettingDto(s.getKey(), s.getValue(), s.getValueType(), s.getDescription(), s.getUpdatedBy(),
                    s.getUpdatedAt());
        }
    }

    public String get(String key, String fallback) {
        if (loadedAt.plusSeconds(30).isBefore(Instant.now())) reload();
        return cache.getOrDefault(key, fallback);
    }

    public boolean bool(String key, boolean fallback) {
        return Boolean.parseBoolean(get(key, String.valueOf(fallback)));
    }

    public int integer(String key, int fallback) {
        try {
            return Integer.parseInt(get(key, String.valueOf(fallback)).trim());
        } catch (NumberFormatException e) {
            return fallback;
        }
    }

    private synchronized void reload() {
        try {
            Map<String, String> fresh = new ConcurrentHashMap<>();
            repo.findAll().forEach(s -> fresh.put(s.getKey(), s.getValue() == null ? "" : s.getValue()));
            cache.clear();
            cache.putAll(fresh);
            loadedAt = Instant.now();
        } catch (RuntimeException e) {
            // keep serving the last known values
        }
    }

    @Transactional(readOnly = true)
    public List<SettingDto> list() {
        return repo.findAll().stream().sorted((a, b) -> a.getKey().compareTo(b.getKey())).map(SettingDto::of).toList();
    }

    @Transactional
    public SettingDto update(String key, String value) {
        SystemSetting s = repo.findById(key).orElseThrow(() -> ApiException.notFound("Setting"));
        String v = value == null ? "" : value.trim();
        switch (s.getValueType()) {
            case "BOOLEAN" -> {
                if (!v.equals("true") && !v.equals("false"))
                    throw ApiException.badRequest("INVALID_VALUE", "Value must be true or false");
            }
            case "NUMBER" -> {
                try {
                    int n = Integer.parseInt(v);
                    if (n < 0 || n > 100_000) throw new NumberFormatException();
                } catch (NumberFormatException e) {
                    throw ApiException.badRequest("INVALID_VALUE", "Value must be a whole number between 0 and 100000");
                }
            }
            default -> {
                if (v.length() > 500) throw ApiException.badRequest("INVALID_VALUE", "Value is too long");
            }
        }
        String old = s.getValue();
        s.setValue(v);
        s.setUpdatedBy(CurrentUser.get().email());
        repo.save(s);
        cache.put(key, v);
        audit.log("SETTING_UPDATED", "SETTING", key, Jsons.map("from", old, "to", v));
        return SettingDto.of(s);
    }
}
