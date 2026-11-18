package com.nexora.project;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.Setter;

import java.time.Instant;

@Entity
@Table(name = "project_members")
@Getter
@Setter
public class ProjectMember {
    @EmbeddedId
    private ProjectMemberId id;
    private String projectRole = "CONTRIBUTOR";
    @Column(updatable = false)
    private Instant joinedAt;

    protected ProjectMember() {
    }

    public ProjectMember(Long projectId, Long userId, String projectRole) {
        this.id = new ProjectMemberId(projectId, userId);
        this.projectRole = projectRole;
    }

    @PrePersist
    void onCreate() { joinedAt = Instant.now(); }

    public Long projectId() { return id.getProjectId(); }
    public Long userId() { return id.getUserId(); }
}
