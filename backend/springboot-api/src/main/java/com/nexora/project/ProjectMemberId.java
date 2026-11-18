package com.nexora.project;

import jakarta.persistence.Column;
import jakarta.persistence.Embeddable;

import java.io.Serializable;
import java.util.Objects;

@Embeddable
public class ProjectMemberId implements Serializable {
    @Column(name = "project_id")
    private Long projectId;
    @Column(name = "user_id")
    private Long userId;

    protected ProjectMemberId() {
    }

    public ProjectMemberId(Long projectId, Long userId) {
        this.projectId = projectId;
        this.userId = userId;
    }

    public Long getProjectId() { return projectId; }
    public Long getUserId() { return userId; }

    @Override
    public boolean equals(Object o) {
        if (this == o) return true;
        if (!(o instanceof ProjectMemberId other)) return false;
        return Objects.equals(projectId, other.projectId) && Objects.equals(userId, other.userId);
    }

    @Override
    public int hashCode() { return Objects.hash(projectId, userId); }
}
