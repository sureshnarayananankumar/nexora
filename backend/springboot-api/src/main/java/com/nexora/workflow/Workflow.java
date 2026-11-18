package com.nexora.workflow;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.Setter;

import java.time.Instant;

@Entity
@Table(name = "workflows")
@Getter
@Setter
public class Workflow {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;
    private Long organizationId;
    private Long projectId;
    private String name;
    private String description;
    @Enumerated(EnumType.STRING)
    private TriggerType triggerType;
    private boolean enabled = true;
    private Long createdBy;
    private int runCount;
    private Instant lastRunAt;
    @Version
    private long version;
    @Column(updatable = false)
    private Instant createdAt;
    private Instant updatedAt;

    @PrePersist
    void onCreate() { createdAt = updatedAt = Instant.now(); }

    @PreUpdate
    void onUpdate() { updatedAt = Instant.now(); }
}
