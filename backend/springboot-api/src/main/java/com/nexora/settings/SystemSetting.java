package com.nexora.settings;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.Setter;

import java.time.Instant;

@Entity
@Table(name = "system_settings")
@Getter
@Setter
public class SystemSetting {
    @Id
    @Column(name = "setting_key")
    private String key;
    @Column(name = "setting_value")
    private String value;
    private String valueType;
    private String description;
    private String updatedBy;
    private Instant updatedAt;

    @PrePersist
    @PreUpdate
    void touch() { updatedAt = Instant.now(); }
}
