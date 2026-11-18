package com.nexora.monitoring;

import com.nexora.security.JwtAuthenticationFilter;
import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.core.Ordered;
import org.springframework.core.annotation.Order;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

import java.io.IOException;

/** Measures every /api request and hands it to the metrics buffer (batched DB writes). */
@Component
@Order(Ordered.HIGHEST_PRECEDENCE + 10)
public class ApiMetricsFilter extends OncePerRequestFilter {

    private final ApiMetricsService metrics;

    public ApiMetricsFilter(ApiMetricsService metrics) {
        this.metrics = metrics;
    }

    @Override
    protected boolean shouldNotFilter(HttpServletRequest request) {
        String uri = request.getRequestURI();
        return !uri.startsWith("/api/") || uri.startsWith("/api/v3/api-docs") || uri.startsWith("/api/swagger-ui")
                || "OPTIONS".equals(request.getMethod());
    }

    @Override
    protected void doFilterInternal(HttpServletRequest request, HttpServletResponse response, FilterChain chain)
            throws ServletException, IOException {
        long start = System.nanoTime();
        try {
            chain.doFilter(request, response);
        } finally {
            long ms = (System.nanoTime() - start) / 1_000_000;
            Object uid = request.getAttribute(JwtAuthenticationFilter.USER_ID_ATTRIBUTE);
            metrics.record(request.getMethod(), normalise(request.getRequestURI()), response.getStatus(), (int) ms,
                    uid instanceof Long l ? l : null);
        }
    }

    /** /api/v1/tasks/42/comments → /api/v1/tasks/{id}/comments, so endpoints aggregate. */
    static String normalise(String uri) {
        String p = uri.replaceAll("/\\d+(?=/|$)", "/{id}");
        return p.length() > 200 ? p.substring(0, 200) : p;
    }
}
