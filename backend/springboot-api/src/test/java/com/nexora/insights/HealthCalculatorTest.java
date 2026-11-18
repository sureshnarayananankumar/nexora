package com.nexora.insights;

import com.nexora.task.TaskPriority;
import com.nexora.task.TaskStatus;
import org.junit.jupiter.api.Test;

import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneOffset;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;

class HealthCalculatorTest {

    static final LocalDate TODAY = LocalDate.of(2026, 6, 15);
    static final Instant NOW = TODAY.atStartOfDay(ZoneOffset.UTC).toInstant();

    static TaskFacts task(long id, TaskStatus status, TaskPriority priority, int points, LocalDate due, Long assignee,
                          Instant updated, Instant completed) {
        return new TaskFacts(id, "T-" + id, "Task " + id, status, priority, points, due, assignee, null,
                NOW.minusSeconds(86_400L * 30), updated, completed);
    }

    @Test
    void healthyProjectScoresHighWithLowRisk() {
        List<TaskFacts> tasks = List.of(
                task(1, TaskStatus.DONE, TaskPriority.MEDIUM, 5, TODAY.minusDays(3), 1L, NOW, NOW.minusSeconds(86_400 * 3)),
                task(2, TaskStatus.IN_PROGRESS, TaskPriority.HIGH, 3, TODAY.plusDays(5), 1L, NOW, null),
                task(3, TaskStatus.TODO, TaskPriority.LOW, 2, TODAY.plusDays(10), 2L, NOW, null));
        var r = HealthCalculator.calculate(new HealthCalculator.Input(TODAY.minusDays(10), TODAY.plusDays(30), TODAY,
                tasks, Map.of(1L, 20, 2L, 20), Map.of(1L, 3, 2L, 2), 7));
        assertThat(r.score()).isGreaterThanOrEqualTo(75);
        assertThat(r.risk()).isEqualTo("LOW");
        assertThat(r.factors()).extracting(HealthCalculator.Factor::code)
                .containsExactly("OVERDUE", "SCHEDULE_SLIP", "BLOCKED", "STALE", "UNOWNED_URGENT", "OVERLOAD");
    }

    @Test
    void overdueBlockedAndOverloadedProjectIsHighRiskAndExplained() {
        List<TaskFacts> tasks = new ArrayList<>();
        for (int i = 0; i < 6; i++) {
            tasks.add(task(i, TaskStatus.TODO, TaskPriority.HIGH, 5, TODAY.minusDays(2), null, NOW, null));
        }
        tasks.add(task(10, TaskStatus.BLOCKED, TaskPriority.MEDIUM, 3, TODAY.plusDays(1), 1L, NOW, null));
        tasks.add(task(11, TaskStatus.IN_PROGRESS, TaskPriority.MEDIUM, 3, null, 1L, NOW.minusSeconds(86_400L * 20), null));
        var r = HealthCalculator.calculate(new HealthCalculator.Input(TODAY.minusDays(90), TODAY.plusDays(10), TODAY,
                tasks, Map.of(1L, 10), Map.of(1L, 30), 7));
        assertThat(r.risk()).isEqualTo("HIGH");
        assertThat(r.score()).isLessThan(50);
        assertThat(r.stats().overdueTasks()).isEqualTo(6);
        assertThat(r.stats().staleTasks()).isEqualTo(1);
        assertThat(r.stats().overloadedMembers()).isEqualTo(1);
        assertThat(r.factors()).allSatisfy(f -> assertThat(f.penalty()).isBetween(0, f.maxPenalty()));
        assertThat(100 - r.factors().stream().mapToInt(HealthCalculator.Factor::penalty).sum()).isEqualTo(r.score());
    }

    @Test
    void forecastUsesRecentVelocityAndReportsLateness() {
        List<TaskFacts> tasks = List.of(
                task(1, TaskStatus.DONE, TaskPriority.MEDIUM, 14, null, 1L, NOW, NOW.minusSeconds(86_400 * 2)),
                task(2, TaskStatus.TODO, TaskPriority.MEDIUM, 20, null, 1L, NOW, null));
        var r = HealthCalculator.calculate(new HealthCalculator.Input(TODAY.minusDays(30), TODAY.plusDays(5), TODAY,
                tasks, Map.of(), Map.of(), 7));
        // velocity = 14 / 14 = 1 point/day, 20 remaining → finish in 20 days, due in 5 → 15 days late
        assertThat(r.forecast().velocityPerDay()).isEqualTo(1.0);
        assertThat(r.forecast().projectedFinish()).isEqualTo(TODAY.plusDays(20));
        assertThat(r.forecast().daysLate()).isEqualTo(15);
    }

    @Test
    void forecastIsHonestWithoutThroughput() {
        var r = HealthCalculator.calculate(new HealthCalculator.Input(TODAY.minusDays(3), TODAY.plusDays(5), TODAY,
                List.of(task(1, TaskStatus.TODO, TaskPriority.LOW, 3, null, null, NOW, null)), Map.of(), Map.of(), 7));
        assertThat(r.forecast().projectedFinish()).isNull();
        assertThat(r.forecast().message()).contains("can't be projected");
    }

    @Test
    void elapsedPercentIsClamped() {
        assertThat(HealthCalculator.elapsedPercent(TODAY.minusDays(10), TODAY.plusDays(10), TODAY)).isEqualTo(50);
        assertThat(HealthCalculator.elapsedPercent(TODAY.minusDays(30), TODAY.minusDays(10), TODAY)).isEqualTo(100);
        assertThat(HealthCalculator.elapsedPercent(TODAY, null, TODAY)).isNull();
    }
}
