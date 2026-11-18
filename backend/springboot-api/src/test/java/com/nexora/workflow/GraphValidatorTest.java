package com.nexora.workflow;

import org.junit.jupiter.api.Test;

import java.util.List;
import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;

class GraphValidatorTest {

    static WorkflowDtos.NodeDto n(String key, String type, String kind, Map<String, Object> cfg) {
        return new WorkflowDtos.NodeDto(key, type, kind, key, cfg, 0, 0);
    }

    static WorkflowDtos.EdgeDto e(String s, String t, String branch) {
        return new WorkflowDtos.EdgeDto(s, t, branch);
    }

    @Test
    void validGraphHasNoErrors() {
        var nodes = List.of(n("t", "TRIGGER", "TASK_CREATED", Map.of()),
                n("c", "CONDITION", "PRIORITY_AT_LEAST", Map.of("priority", "HIGH")),
                n("a", "ACTION", "NOTIFY_ASSIGNEE", Map.of("message", "hi")),
                n("b", "ACTION", "ADD_COMMENT", Map.of("text", "low")));
        var edges = List.of(e("t", "c", null), e("c", "a", "TRUE"), e("c", "b", "FALSE"));
        assertThat(GraphValidator.validate(nodes, edges)).isEmpty();
    }

    @Test
    void detectsCycleMissingTriggerAndUnreachableNodes() {
        var nodes = List.of(n("a", "ACTION", "SET_PRIORITY", Map.of("priority", "LOW")),
                n("b", "ACTION", "SET_STATUS", Map.of("status", "DONE")));
        var edges = List.of(e("a", "b", null), e("b", "a", null));
        var errors = GraphValidator.validate(nodes, edges);
        assertThat(errors).anyMatch(s -> s.contains("exactly one trigger"));
        assertThat(errors).anyMatch(s -> s.contains("loop"));
    }

    @Test
    void conditionBranchesAndConfigAreChecked() {
        var nodes = List.of(n("t", "TRIGGER", "TASK_CREATED", Map.of()),
                n("c", "CONDITION", "STATUS_IS", Map.of("status", "NOPE")),
                n("a", "ACTION", "SET_PRIORITY", Map.of()),
                n("x", "ACTION", "ADD_COMMENT", Map.of("text", "orphan")));
        var edges = List.of(e("t", "c", null), e("c", "a", null));
        var errors = GraphValidator.validate(nodes, edges);
        assertThat(errors).anyMatch(s -> s.contains("unknown status"));
        assertThat(errors).anyMatch(s -> s.contains("Yes or No"));
        assertThat(errors).anyMatch(s -> s.contains("needs a value for Priority"));
        assertThat(errors).anyMatch(s -> s.contains("isn't reachable"));
    }
}
