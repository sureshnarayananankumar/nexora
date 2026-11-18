package com.nexora.monitoring;

import org.junit.jupiter.api.Test;

import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;

class ApiMetricsTest {

    @Test
    void normalisesIdsSoEndpointsAggregate() {
        assertThat(ApiMetricsFilter.normalise("/api/v1/tasks/42/comments")).isEqualTo("/api/v1/tasks/{id}/comments");
        assertThat(ApiMetricsFilter.normalise("/api/v1/projects/7")).isEqualTo("/api/v1/projects/{id}");
        assertThat(ApiMetricsFilter.normalise("/api/v1/v2things")).isEqualTo("/api/v1/v2things");
    }

    @Test
    void p95() {
        assertThat(ApiMetricsService.p95(List.of())).isZero();
        assertThat(ApiMetricsService.p95(List.of(1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 100))).isEqualTo(19);
    }
}
