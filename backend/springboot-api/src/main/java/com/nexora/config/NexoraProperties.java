package com.nexora.config;

import org.springframework.boot.context.properties.ConfigurationProperties;

import java.util.List;

@ConfigurationProperties(prefix = "nexora")
public record NexoraProperties(
        Jwt jwt,
        boolean cookieSecure,
        boolean seedDemo,
        String demoPassword,
        List<String> corsOrigins,
        String eventsStream
) {
    public record Jwt(String secret, long accessTtlMinutes, long refreshTtlDays) {
    }
}
