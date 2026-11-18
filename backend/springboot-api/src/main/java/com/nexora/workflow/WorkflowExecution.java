package com.nexora.workflow;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.Setter;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;

import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;

@Entity
@Table(name = "workflow_executions")
@Getter
@Setter
public class WorkflowExecution {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;
    private Long workflowId;
    private String triggerEvent;
    private Long taskId;
    private String status;
    private boolean dryRun;
    @JdbcTypeCode(SqlTypes.JSON)
    private List<Map<String, Object>> steps = new ArrayList<>();
    private String errorMessage;
    private Instant startedAt;
    private Instant finishedAt;
    private int durationMs;
}
