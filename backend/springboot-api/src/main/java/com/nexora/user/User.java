package com.nexora.user;

import com.nexora.role.Role;
import jakarta.persistence.*;
import lombok.Getter;
import lombok.Setter;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;

import java.time.Instant;
import java.util.List;

@Entity
@Table(name = "users")
@Getter
@Setter
public class User {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;
    @Column(name = "organization_id")
    private Long organizationId;
    @ManyToOne(fetch = FetchType.EAGER, optional = false)
    @JoinColumn(name = "role_id")
    private Role role;
    private String email;
    private String passwordHash;
    private String fullName;
    private String jobTitle;
    private String avatarColor = "#6366F1";
    private int capacityPoints = 20;
    private String timezone = "UTC";
    private String theme = "system";
    @JdbcTypeCode(SqlTypes.JSON)
    private List<String> dashboardLayout;
    private String status = "ACTIVE";
    private Instant lastLoginAt;
    @Column(updatable = false)
    private Instant createdAt;
    private Instant updatedAt;

    @PrePersist
    void onCreate() { createdAt = updatedAt = Instant.now(); }

    @PreUpdate
    void onUpdate() { updatedAt = Instant.now(); }

    public boolean isActive() { return "ACTIVE".equals(status); }
}
