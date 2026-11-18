package com.nexora.workflow;

import com.nexora.task.Task;
import com.nexora.task.TaskPriority;
import com.nexora.task.TaskStatus;
import org.junit.jupiter.api.Test;

import java.time.LocalDate;
import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;

class ConditionEvaluatorTest {

    static final LocalDate TODAY = LocalDate.of(2026, 6, 15);

    static Task task() {
        Task t = new Task();
        t.setTitle("Bug: login fails on Safari");
        t.setStatus(TaskStatus.IN_REVIEW);
        t.setPriority(TaskPriority.HIGH);
        t.setDueDate(TODAY.plusDays(2));
        return t;
    }

    @Test
    void evaluatesEachConditionKind() {
        Task t = task();
        assertThat(ConditionEvaluator.evaluate("STATUS_IS", Map.of("status", "IN_REVIEW"), t, TODAY).value()).isTrue();
        assertThat(ConditionEvaluator.evaluate("PRIORITY_AT_LEAST", Map.of("priority", "CRITICAL"), t, TODAY).value()).isFalse();
        assertThat(ConditionEvaluator.evaluate("DUE_WITHIN_DAYS", Map.of("days", 3), t, TODAY).value()).isTrue();
        assertThat(ConditionEvaluator.evaluate("DUE_WITHIN_DAYS", Map.of("days", 1), t, TODAY).value()).isFalse();
        assertThat(ConditionEvaluator.evaluate("TITLE_CONTAINS", Map.of("text", "BUG"), t, TODAY).value()).isTrue();
        assertThat(ConditionEvaluator.evaluate("IS_UNASSIGNED", Map.of(), t, TODAY).value()).isTrue();
    }
}
