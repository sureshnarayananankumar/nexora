package com.nexora.insights;

import com.nexora.task.TaskPriority;
import com.nexora.task.TaskStatus;
import org.junit.jupiter.api.Test;

import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneOffset;
import java.util.List;
import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;

class PriorityRecommenderTest {

    static final LocalDate TODAY = LocalDate.of(2026, 6, 15);

    static TaskFacts t(long id, TaskPriority p, LocalDate due, Long milestone, int ageDays) {
        Instant created = TODAY.minusDays(ageDays).atStartOfDay(ZoneOffset.UTC).toInstant();
        return new TaskFacts(id, "T-" + id, "Task " + id, TaskStatus.TODO, p, 3, due, null, milestone, created, created, null);
    }

    @Test
    void overdueBlockingTaskBecomesCritical() {
        var recs = PriorityRecommender.recommend(List.of(t(1, TaskPriority.LOW, TODAY.minusDays(1), null, 1)),
                Map.of(1L, 3), Map.of(), TODAY);
        // 40 urgency + 24 blocking = 64 → CRITICAL
        assertThat(recs).singleElement().satisfies(r -> {
            assertThat(r.recommended()).isEqualTo(TaskPriority.CRITICAL);
            assertThat(r.score()).isEqualTo(64);
            assertThat(r.reasons()).anyMatch(s -> s.startsWith("Overdue")).anyMatch(s -> s.startsWith("Blocks 3"));
        });
    }

    @Test
    void relaxedCriticalTaskIsDowngradedWithAReason() {
        var recs = PriorityRecommender.recommend(List.of(t(2, TaskPriority.CRITICAL, null, null, 0)),
                Map.of(), Map.of(), TODAY);
        assertThat(recs).singleElement().satisfies(r -> {
            assertThat(r.recommended()).isEqualTo(TaskPriority.MEDIUM);
            assertThat(r.reasons()).isNotEmpty();
        });
    }

    @Test
    void tasksAlreadyAtTheRightPriorityAreNotListed() {
        var recs = PriorityRecommender.recommend(List.of(t(3, TaskPriority.HIGH, TODAY.plusDays(1), 9L, 0)),
                Map.of(), Map.of(9L, TODAY.plusDays(3)), TODAY);
        // 30 + 12 + 10 = 52 → HIGH (unchanged)
        assertThat(recs).isEmpty();
    }
}
