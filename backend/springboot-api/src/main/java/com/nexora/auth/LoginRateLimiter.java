package com.nexora.auth;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.stereotype.Component;

import java.time.Duration;
import java.util.Locale;

/** Blocks an email for 15 minutes after 5 failed logins. Fails open if Redis is unavailable. */
@Component
public class LoginRateLimiter {

    private static final Logger log = LoggerFactory.getLogger(LoginRateLimiter.class);
    static final int MAX_FAILURES = 5;
    static final Duration WINDOW = Duration.ofMinutes(15);

    private final StringRedisTemplate redis;

    public LoginRateLimiter(StringRedisTemplate redis) {
        this.redis = redis;
    }

    private String key(String email) {
        return "nexora:login-fail:" + email.toLowerCase(Locale.ROOT);
    }

    public boolean isBlocked(String email) {
        try {
            String v = redis.opsForValue().get(key(email));
            return v != null && Integer.parseInt(v) >= MAX_FAILURES;
        } catch (RuntimeException e) {
            log.debug("Rate limiter unavailable: {}", e.getMessage());
            return false;
        }
    }

    public void recordFailure(String email) {
        try {
            Long n = redis.opsForValue().increment(key(email));
            if (n != null && n == 1L) redis.expire(key(email), WINDOW);
        } catch (RuntimeException e) {
            log.debug("Rate limiter unavailable: {}", e.getMessage());
        }
    }

    public void reset(String email) {
        try {
            redis.delete(key(email));
        } catch (RuntimeException e) {
            log.debug("Rate limiter unavailable: {}", e.getMessage());
        }
    }
}
