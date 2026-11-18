package com.nexora.workflow;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.Setter;

@Entity
@Table(name = "workflow_edges")
@Getter
@Setter
public class WorkflowEdge {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;
    private Long workflowId;
    private String sourceKey;
    private String targetKey;
    /** TRUE / FALSE for edges leaving a condition node, null otherwise. */
    private String branch;
}
