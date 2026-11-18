package com.nexora.workflow;

import com.nexora.task.TaskPriority;
import com.nexora.task.TaskStatus;

import java.util.*;

/** Structural and configuration checks for a workflow graph before it is saved. */
public final class GraphValidator {

    private GraphValidator() {
    }

    public static List<String> validate(List<WorkflowDtos.NodeDto> nodes, List<WorkflowDtos.EdgeDto> edges) {
        List<String> errors = new ArrayList<>();
        Map<String, WorkflowDtos.NodeDto> byKey = new LinkedHashMap<>();
        for (WorkflowDtos.NodeDto n : nodes) {
            if (byKey.put(n.key(), n) != null) errors.add("Duplicate node id \"" + n.key() + "\"");
            NodeCatalog.NodeKind kind = NodeCatalog.find(n.type(), n.kind());
            if (kind == null) {
                errors.add("Unknown block " + n.type() + "/" + n.kind());
                continue;
            }
            checkConfig(n, kind, errors);
        }
        List<WorkflowDtos.NodeDto> triggers = nodes.stream().filter(n -> "TRIGGER".equals(n.type())).toList();
        if (triggers.size() != 1) errors.add("A workflow needs exactly one trigger (found " + triggers.size() + ")");
        if (nodes.stream().noneMatch(n -> "ACTION".equals(n.type()))) errors.add("Add at least one action");

        Map<String, List<WorkflowDtos.EdgeDto>> out = new HashMap<>();
        Map<String, Integer> indegree = new HashMap<>();
        byKey.keySet().forEach(k -> indegree.put(k, 0));
        Set<String> pairs = new HashSet<>();
        for (WorkflowDtos.EdgeDto e : edges) {
            WorkflowDtos.NodeDto src = byKey.get(e.source());
            WorkflowDtos.NodeDto dst = byKey.get(e.target());
            if (src == null || dst == null) {
                errors.add("A connection points to a block that doesn't exist");
                continue;
            }
            if (e.source().equals(e.target())) errors.add("A block can't connect to itself");
            if ("TRIGGER".equals(dst.type())) errors.add("Nothing can connect into the trigger");
            if (!pairs.add(e.source() + "->" + e.target())) errors.add("Duplicate connection " + e.source() + " → " + e.target());
            if ("CONDITION".equals(src.type())) {
                if (!"TRUE".equals(e.branch()) && !"FALSE".equals(e.branch())) {
                    errors.add("Connections from condition \"" + label(src) + "\" must use the Yes or No handle");
                }
            } else if (e.branch() != null) {
                errors.add("Only conditions have Yes/No branches");
            }
            out.computeIfAbsent(e.source(), k -> new ArrayList<>()).add(e);
            indegree.merge(e.target(), 1, Integer::sum);
        }
        for (WorkflowDtos.NodeDto n : nodes) {
            if (!"CONDITION".equals(n.type())) continue;
            List<WorkflowDtos.EdgeDto> o = out.getOrDefault(n.key(), List.of());
            long t = o.stream().filter(e -> "TRUE".equals(e.branch())).count();
            long f = o.stream().filter(e -> "FALSE".equals(e.branch())).count();
            if (t > 1 || f > 1) errors.add("Condition \"" + label(n) + "\" can have at most one Yes and one No path");
            if (t == 0 && f == 0) errors.add("Condition \"" + label(n) + "\" isn't connected to anything");
        }

        // Kahn's algorithm: if we can't remove every node, there is a cycle.
        Deque<String> queue = new ArrayDeque<>();
        Map<String, Integer> deg = new HashMap<>(indegree);
        deg.forEach((k, v) -> { if (v == 0) queue.add(k); });
        int visited = 0;
        while (!queue.isEmpty()) {
            String k = queue.poll();
            visited++;
            for (WorkflowDtos.EdgeDto e : out.getOrDefault(k, List.of())) {
                if (deg.merge(e.target(), -1, Integer::sum) == 0) queue.add(e.target());
            }
        }
        if (visited < byKey.size()) errors.add("The workflow contains a loop; remove the connection that goes back");

        if (triggers.size() == 1) {
            Set<String> reach = new HashSet<>();
            Deque<String> stack = new ArrayDeque<>(List.of(triggers.get(0).key()));
            while (!stack.isEmpty()) {
                String k = stack.pop();
                if (reach.add(k)) out.getOrDefault(k, List.of()).forEach(e -> stack.push(e.target()));
            }
            byKey.values().stream().filter(n -> !reach.contains(n.key()))
                    .forEach(n -> errors.add("\"" + label(n) + "\" isn't reachable from the trigger"));
        }
        return errors.stream().distinct().toList();
    }

    private static void checkConfig(WorkflowDtos.NodeDto n, NodeCatalog.NodeKind kind, List<String> errors) {
        Map<String, Object> cfg = n.config() == null ? Map.of() : n.config();
        for (NodeCatalog.Field f : kind.fields()) {
            Object v = cfg.get(f.name());
            boolean blank = v == null || String.valueOf(v).isBlank();
            if (blank) {
                if (f.required()) errors.add("\"" + label(n) + "\" needs a value for " + f.label());
                continue;
            }
            String s = String.valueOf(v);
            switch (f.type()) {
                case "status" -> { if (!isEnum(TaskStatus.class, s)) errors.add("\"" + label(n) + "\": unknown status " + s); }
                case "priority" -> { if (!isEnum(TaskPriority.class, s)) errors.add("\"" + label(n) + "\": unknown priority " + s); }
                case "number" -> {
                    try {
                        int d = (int) Double.parseDouble(s);
                        if (d < 0 || d > 365) errors.add("\"" + label(n) + "\": days must be 0-365");
                    } catch (NumberFormatException e) {
                        errors.add("\"" + label(n) + "\": days must be a number");
                    }
                }
                case "user" -> {
                    try { Long.parseLong(s.replace(".0", "")); }
                    catch (NumberFormatException e) { errors.add("\"" + label(n) + "\": choose a person"); }
                }
                case "text" -> { if (s.length() > 500) errors.add("\"" + label(n) + "\": text is longer than 500 characters"); }
                default -> { }
            }
        }
    }

    private static <E extends Enum<E>> boolean isEnum(Class<E> type, String v) {
        try {
            Enum.valueOf(type, v);
            return true;
        } catch (IllegalArgumentException e) {
            return false;
        }
    }

    private static String label(WorkflowDtos.NodeDto n) {
        return n.label() == null || n.label().isBlank() ? n.kind() : n.label();
    }
}
