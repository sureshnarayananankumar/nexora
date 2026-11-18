package com.nexora.workflow;

import java.util.List;
import java.util.Map;

/** The building blocks offered in the visual builder, with the config fields each one needs. */
public final class NodeCatalog {
    private NodeCatalog() {
    }

    public record Field(String name, String type, boolean required, String label) {
    }

    public record NodeKind(String type, String kind, String label, String description, List<Field> fields) {
    }

    public static final List<NodeKind> KINDS = List.of(
            new NodeKind("TRIGGER", "TASK_CREATED", "Task created", "Runs when a task is created", List.of()),
            new NodeKind("TRIGGER", "TASK_STATUS_CHANGED", "Status changed", "Runs when a task moves column",
                    List.of(new Field("toStatus", "status", false, "Only when moved to"))),
            new NodeKind("TRIGGER", "TASK_ASSIGNED", "Task assigned", "Runs when a task gets a new assignee", List.of()),
            new NodeKind("TRIGGER", "COMMENT_ADDED", "Comment added", "Runs when someone comments on a task", List.of()),
            new NodeKind("TRIGGER", "TASK_OVERDUE", "Task overdue", "Checked every 15 minutes; runs once per task per day", List.of()),

            new NodeKind("CONDITION", "STATUS_IS", "Status is", "True when the task is in the given status",
                    List.of(new Field("status", "status", true, "Status"))),
            new NodeKind("CONDITION", "PRIORITY_AT_LEAST", "Priority at least", "True when priority is at or above the level",
                    List.of(new Field("priority", "priority", true, "Priority"))),
            new NodeKind("CONDITION", "DUE_WITHIN_DAYS", "Due within", "True when the due date is within N days (or overdue)",
                    List.of(new Field("days", "number", true, "Days"))),
            new NodeKind("CONDITION", "TITLE_CONTAINS", "Title contains", "Case-insensitive text match on the title",
                    List.of(new Field("text", "text", true, "Text"))),
            new NodeKind("CONDITION", "IS_UNASSIGNED", "Is unassigned", "True when nobody owns the task", List.of()),

            new NodeKind("ACTION", "SET_PRIORITY", "Set priority", "Change the task's priority",
                    List.of(new Field("priority", "priority", true, "Priority"))),
            new NodeKind("ACTION", "SET_STATUS", "Move to status", "Move the task to another column",
                    List.of(new Field("status", "status", true, "Status"))),
            new NodeKind("ACTION", "ASSIGN_USER", "Assign to person", "Assign the task to a specific project member",
                    List.of(new Field("userId", "user", true, "Person"))),
            new NodeKind("ACTION", "ASSIGN_LEAST_LOADED", "Assign least-loaded", "Assign to the project member with the lowest utilisation", List.of()),
            new NodeKind("ACTION", "NOTIFY_ASSIGNEE", "Notify assignee", "Send a notification to the assignee",
                    List.of(new Field("message", "text", true, "Message"))),
            new NodeKind("ACTION", "NOTIFY_USER", "Notify person", "Send a notification to a specific person",
                    List.of(new Field("userId", "user", true, "Person"), new Field("message", "text", true, "Message"))),
            new NodeKind("ACTION", "NOTIFY_PROJECT_OWNER", "Notify project owner", "Send a notification to the project owner",
                    List.of(new Field("message", "text", true, "Message"))),
            new NodeKind("ACTION", "ADD_COMMENT", "Add comment", "Post an automated comment on the task",
                    List.of(new Field("text", "text", true, "Comment")))
    );

    public static NodeKind find(String type, String kind) {
        return KINDS.stream().filter(k -> k.type().equals(type) && k.kind().equals(kind)).findFirst().orElse(null);
    }

    public static Map<String, Object> placeholders() {
        return Map.of("tokens", List.of("{task}", "{title}", "{status}", "{priority}", "{assignee}", "{project}"));
    }
}
