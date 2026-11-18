package com.nexora.insights;

import com.nexora.task.TaskPriority;
import com.nexora.task.TaskStatus;
import org.junit.jupiter.api.Test;

import java.time.Instant;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;

class WorkloadBalancerTest {

    static TaskFacts t(long id, long assignee, int points, TaskStatus status, TaskPriority p) {
        return new TaskFacts(id, "T-" + id, "Task " + id, status, p, points, null, assignee, null, Instant.EPOCH, Instant.EPOCH, null);
    }

    @Test
    void suggestsMovingLowPriorityNotStartedWorkFromOverloadedToAvailable() {
        var members = List.of(
                new WorkloadBalancer.Member(1L, "Diego", "#000", 10, 18, 4),
                new WorkloadBalancer.Member(2L, "Aisha", "#000", 20, 4, 1));
        var tasks = List.of(
                t(10, 1, 5, TaskStatus.IN_PROGRESS, TaskPriority.LOW),
                t(11, 1, 5, TaskStatus.TODO, TaskPriority.LOW),
                t(12, 1, 5, TaskStatus.TODO, TaskPriority.CRITICAL),
                t(13, 1, 3, TaskStatus.TODO, TaskPriority.MEDIUM));
        var result = WorkloadBalancer.analyze(members, tasks);
        assertThat(result.members().get(0).state()).isEqualTo("OVERLOADED");
        // in-progress work is never moved; lowest priority first until Diego is ≤ 100 %
        assertThat(result.suggestions()).extracting(WorkloadBalancer.Suggestion::taskId).containsExactly(11L, 13L);
        assertThat(result.suggestions()).allMatch(s -> s.toUserId() == 2L);
    }

    @Test
    void noSuggestionWhenNobodyHasRoom() {
        var members = List.of(
                new WorkloadBalancer.Member(1L, "A", "#000", 10, 15, 2),
                new WorkloadBalancer.Member(2L, "B", "#000", 10, 9, 2));
        var result = WorkloadBalancer.analyze(members, List.of(t(1, 1, 5, TaskStatus.TODO, TaskPriority.LOW)));
        assertThat(result.suggestions()).isEmpty();
    }

    @Test
    void utilisationStates() {
        assertThat(WorkloadBalancer.state(WorkloadBalancer.utilization(25, 20))).isEqualTo("OVERLOADED");
        assertThat(WorkloadBalancer.state(WorkloadBalancer.utilization(15, 20))).isEqualTo("BALANCED");
        assertThat(WorkloadBalancer.state(WorkloadBalancer.utilization(5, 20))).isEqualTo("AVAILABLE");
    }
}
