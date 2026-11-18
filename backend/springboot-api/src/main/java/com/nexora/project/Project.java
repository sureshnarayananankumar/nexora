package com.nexora.project;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.Setter;

import java.time.Instant;
import java.time.LocalDate;

@Entity
@Table(name = "projects")
@Getter
@Setter
public class Project {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;
    private Long organizationId;
    @Column(name = "project_key")
    private String key;
    private String name;
    private String description;
    private String status = "ACTIVE";
    private String color = "#6366F1";
    private Long ownerId;
    private LocalDate startDate;
    private LocalDate dueDate;
    private int taskSequence;
    @Column(updatable = false)
    private Instant createdAt;
    private Instant updatedAt;

    @PrePersist
    void onCreate() { createdAt = updatedAt = Instant.now(); }

    @PreUpdate
    void onUpdate() { updatedAt = Instant.now(); }
}
