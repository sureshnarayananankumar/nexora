package com.nexora.task;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.Setter;

import java.time.Instant;
import java.time.LocalDate;
import java.util.HashSet;
import java.util.Set;

@Entity
@Table(name = "tasks")
@Getter
@Setter
public class Task {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;
    private Long projectId;
    private int taskNumber;
    private String title;
    private String description;
    @Enumerated(EnumType.STRING)
    private TaskStatus status = TaskStatus.TODO;
    @Enumerated(EnumType.STRING)
    private TaskPriority priority = TaskPriority.MEDIUM;
    private Long assigneeId;
    private Long reporterId;
    private Long milestoneId;
    private Integer storyPoints;
    private LocalDate dueDate;
    private double position;
    private String blockedReason;
    private Instant startedAt;
    private Instant completedAt;
    @Version
    private long version;
    @Column(updatable = false)
    private Instant createdAt;
    private Instant updatedAt;

    /** IDs of tasks this task waits on (task_dependencies.depends_on_task_id). */
    @ElementCollection(fetch = FetchType.LAZY)
    @CollectionTable(name = "task_dependencies", joinColumns = @JoinColumn(name = "task_id"))
    @Column(name = "depends_on_task_id")
    private Set<Long> dependsOn = new HashSet<>();

    @PrePersist
    void onCreate() { createdAt = updatedAt = Instant.now(); }

    @PreUpdate
    void onUpdate() { updatedAt = Instant.now(); }

    public boolean isOpen() { return status.isOpen(); }

    public int effectivePoints() { return storyPoints == null ? 3 : storyPoints; }

    public boolean isOverdue(LocalDate today) {
        return isOpen() && dueDate != null && dueDate.isBefore(today);
    }

    /** Keeps started/completed timestamps consistent with the status. */
    public void changeStatus(TaskStatus next) {
        if (next == status) return;
        if (next == TaskStatus.IN_PROGRESS && startedAt == null) startedAt = Instant.now();
        if (next == TaskStatus.DONE) completedAt = Instant.now();
        if (status == TaskStatus.DONE && next != TaskStatus.DONE) completedAt = null;
        if (next != TaskStatus.BLOCKED) blockedReason = null;
        status = next;
    }
}
