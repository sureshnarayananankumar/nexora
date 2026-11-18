-- ═══════════════════════════════════════════════════════════════════
-- NEXORA · V1 · core schema (MySQL 8.4, InnoDB, utf8mb4)
-- ═══════════════════════════════════════════════════════════════════

-- ── Subscription plans ─────────────────────────────────────────────
CREATE TABLE plans (
    id             BIGINT       NOT NULL AUTO_INCREMENT,
    code           VARCHAR(40)  NOT NULL,
    name           VARCHAR(80)  NOT NULL,
    description    VARCHAR(255) NULL,
    price_monthly  DECIMAL(10,2) NOT NULL DEFAULT 0,
    max_users      INT          NOT NULL,
    max_projects   INT          NOT NULL,
    max_workflows  INT          NOT NULL,
    active         BOOLEAN      NOT NULL DEFAULT TRUE,
    created_at     DATETIME(6)  NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    updated_at     DATETIME(6)  NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
    PRIMARY KEY (id),
    UNIQUE KEY uk_plans_code (code)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- ── Organisations (tenants) ────────────────────────────────────────
CREATE TABLE organizations (
    id          BIGINT       NOT NULL AUTO_INCREMENT,
    name        VARCHAR(120) NOT NULL,
    slug        VARCHAR(80)  NOT NULL,
    plan_id     BIGINT       NOT NULL,
    status      VARCHAR(20)  NOT NULL DEFAULT 'ACTIVE',
    industry    VARCHAR(80)  NULL,
    created_at  DATETIME(6)  NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    updated_at  DATETIME(6)  NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
    PRIMARY KEY (id),
    UNIQUE KEY uk_organizations_slug (slug),
    KEY idx_organizations_plan (plan_id),
    KEY idx_organizations_status (status),
    CONSTRAINT fk_organizations_plan FOREIGN KEY (plan_id) REFERENCES plans (id),
    CONSTRAINT chk_organizations_status CHECK (status IN ('ACTIVE','SUSPENDED'))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- ── Roles & permissions ────────────────────────────────────────────
CREATE TABLE roles (
    id           BIGINT       NOT NULL AUTO_INCREMENT,
    name         VARCHAR(50)  NOT NULL,
    description  VARCHAR(255) NULL,
    system_role  BOOLEAN      NOT NULL DEFAULT FALSE,
    created_at   DATETIME(6)  NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    PRIMARY KEY (id),
    UNIQUE KEY uk_roles_name (name)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE permissions (
    id           BIGINT       NOT NULL AUTO_INCREMENT,
    code         VARCHAR(60)  NOT NULL,
    description  VARCHAR(255) NOT NULL,
    category     VARCHAR(40)  NOT NULL,
    PRIMARY KEY (id),
    UNIQUE KEY uk_permissions_code (code)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE role_permissions (
    role_id        BIGINT NOT NULL,
    permission_id  BIGINT NOT NULL,
    PRIMARY KEY (role_id, permission_id),
    KEY idx_role_permissions_permission (permission_id),
    CONSTRAINT fk_role_permissions_role FOREIGN KEY (role_id) REFERENCES roles (id) ON DELETE CASCADE,
    CONSTRAINT fk_role_permissions_permission FOREIGN KEY (permission_id) REFERENCES permissions (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- ── Users ──────────────────────────────────────────────────────────
CREATE TABLE users (
    id                BIGINT       NOT NULL AUTO_INCREMENT,
    organization_id   BIGINT       NOT NULL,
    role_id           BIGINT       NOT NULL,
    email             VARCHAR(190) NOT NULL,
    password_hash     VARCHAR(100) NOT NULL,
    full_name         VARCHAR(120) NOT NULL,
    job_title         VARCHAR(120) NULL,
    avatar_color      VARCHAR(9)   NOT NULL DEFAULT '#6366F1',
    capacity_points   INT          NOT NULL DEFAULT 20,
    timezone          VARCHAR(60)  NOT NULL DEFAULT 'UTC',
    theme             VARCHAR(10)  NOT NULL DEFAULT 'system',
    dashboard_layout  JSON         NULL,
    status            VARCHAR(20)  NOT NULL DEFAULT 'ACTIVE',
    last_login_at     DATETIME(6)  NULL,
    created_at        DATETIME(6)  NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    updated_at        DATETIME(6)  NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
    PRIMARY KEY (id),
    UNIQUE KEY uk_users_email (email),
    KEY idx_users_org (organization_id),
    KEY idx_users_role (role_id),
    KEY idx_users_org_status (organization_id, status),
    CONSTRAINT fk_users_org FOREIGN KEY (organization_id) REFERENCES organizations (id),
    CONSTRAINT fk_users_role FOREIGN KEY (role_id) REFERENCES roles (id),
    CONSTRAINT chk_users_status CHECK (status IN ('ACTIVE','SUSPENDED')),
    CONSTRAINT chk_users_capacity CHECK (capacity_points BETWEEN 1 AND 200),
    CONSTRAINT chk_users_theme CHECK (theme IN ('light','dark','system'))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE refresh_tokens (
    id           BIGINT      NOT NULL AUTO_INCREMENT,
    user_id      BIGINT      NOT NULL,
    token_hash   CHAR(64)    NOT NULL,
    client       VARCHAR(20) NOT NULL DEFAULT 'web',
    expires_at   DATETIME(6) NOT NULL,
    revoked_at   DATETIME(6) NULL,
    replaced_by  BIGINT      NULL,
    user_agent   VARCHAR(255) NULL,
    ip_address   VARCHAR(45) NULL,
    created_at   DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    PRIMARY KEY (id),
    UNIQUE KEY uk_refresh_tokens_hash (token_hash),
    KEY idx_refresh_tokens_user (user_id),
    KEY idx_refresh_tokens_expires (expires_at),
    CONSTRAINT fk_refresh_tokens_user FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- ── Projects ───────────────────────────────────────────────────────
CREATE TABLE projects (
    id               BIGINT       NOT NULL AUTO_INCREMENT,
    organization_id  BIGINT       NOT NULL,
    project_key      VARCHAR(10)  NOT NULL,
    name             VARCHAR(120) NOT NULL,
    description      TEXT         NULL,
    status           VARCHAR(20)  NOT NULL DEFAULT 'ACTIVE',
    color            VARCHAR(9)   NOT NULL DEFAULT '#6366F1',
    owner_id         BIGINT       NOT NULL,
    start_date       DATE         NOT NULL,
    due_date         DATE         NULL,
    task_sequence    INT          NOT NULL DEFAULT 0,
    created_at       DATETIME(6)  NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    updated_at       DATETIME(6)  NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
    PRIMARY KEY (id),
    UNIQUE KEY uk_projects_org_key (organization_id, project_key),
    KEY idx_projects_org_status (organization_id, status),
    KEY idx_projects_owner (owner_id),
    CONSTRAINT fk_projects_org FOREIGN KEY (organization_id) REFERENCES organizations (id),
    CONSTRAINT fk_projects_owner FOREIGN KEY (owner_id) REFERENCES users (id),
    CONSTRAINT chk_projects_status CHECK (status IN ('ACTIVE','ON_HOLD','COMPLETED','ARCHIVED')),
    CONSTRAINT chk_projects_dates CHECK (due_date IS NULL OR due_date >= start_date)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE project_members (
    project_id    BIGINT      NOT NULL,
    user_id       BIGINT      NOT NULL,
    project_role  VARCHAR(20) NOT NULL DEFAULT 'CONTRIBUTOR',
    joined_at     DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    PRIMARY KEY (project_id, user_id),
    KEY idx_project_members_user (user_id),
    CONSTRAINT fk_project_members_project FOREIGN KEY (project_id) REFERENCES projects (id) ON DELETE CASCADE,
    CONSTRAINT fk_project_members_user FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE,
    CONSTRAINT chk_project_members_role CHECK (project_role IN ('OWNER','CONTRIBUTOR','VIEWER'))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE milestones (
    id           BIGINT       NOT NULL AUTO_INCREMENT,
    project_id   BIGINT       NOT NULL,
    name         VARCHAR(120) NOT NULL,
    description  VARCHAR(500) NULL,
    due_date     DATE         NOT NULL,
    completed    BOOLEAN      NOT NULL DEFAULT FALSE,
    created_at   DATETIME(6)  NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    PRIMARY KEY (id),
    KEY idx_milestones_project_due (project_id, due_date),
    CONSTRAINT fk_milestones_project FOREIGN KEY (project_id) REFERENCES projects (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- ── Tasks ──────────────────────────────────────────────────────────
CREATE TABLE tasks (
    id              BIGINT       NOT NULL AUTO_INCREMENT,
    project_id      BIGINT       NOT NULL,
    task_number     INT          NOT NULL,
    title           VARCHAR(200) NOT NULL,
    description     TEXT         NULL,
    status          VARCHAR(20)  NOT NULL DEFAULT 'TODO',
    priority        VARCHAR(20)  NOT NULL DEFAULT 'MEDIUM',
    assignee_id     BIGINT       NULL,
    reporter_id     BIGINT       NOT NULL,
    milestone_id    BIGINT       NULL,
    story_points    INT          NULL,
    due_date        DATE         NULL,
    position        DOUBLE       NOT NULL DEFAULT 0,
    blocked_reason  VARCHAR(255) NULL,
    started_at      DATETIME(6)  NULL,
    completed_at    DATETIME(6)  NULL,
    version         BIGINT       NOT NULL DEFAULT 0,
    created_at      DATETIME(6)  NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    updated_at      DATETIME(6)  NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
    PRIMARY KEY (id),
    UNIQUE KEY uk_tasks_project_number (project_id, task_number),
    KEY idx_tasks_project_status_position (project_id, status, position),
    KEY idx_tasks_assignee_status (assignee_id, status),
    KEY idx_tasks_due (due_date),
    KEY idx_tasks_milestone (milestone_id),
    KEY idx_tasks_reporter (reporter_id),
    KEY idx_tasks_completed (project_id, completed_at),
    CONSTRAINT fk_tasks_project FOREIGN KEY (project_id) REFERENCES projects (id) ON DELETE CASCADE,
    CONSTRAINT fk_tasks_assignee FOREIGN KEY (assignee_id) REFERENCES users (id) ON DELETE SET NULL,
    CONSTRAINT fk_tasks_reporter FOREIGN KEY (reporter_id) REFERENCES users (id),
    CONSTRAINT fk_tasks_milestone FOREIGN KEY (milestone_id) REFERENCES milestones (id) ON DELETE SET NULL,
    CONSTRAINT chk_tasks_status CHECK (status IN ('BACKLOG','TODO','IN_PROGRESS','IN_REVIEW','BLOCKED','DONE')),
    CONSTRAINT chk_tasks_priority CHECK (priority IN ('LOW','MEDIUM','HIGH','CRITICAL')),
    CONSTRAINT chk_tasks_points CHECK (story_points IS NULL OR story_points BETWEEN 0 AND 100)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE task_dependencies (
    task_id             BIGINT NOT NULL,
    depends_on_task_id  BIGINT NOT NULL,
    PRIMARY KEY (task_id, depends_on_task_id),
    KEY idx_task_dependencies_depends_on (depends_on_task_id),
    CONSTRAINT fk_task_dependencies_task FOREIGN KEY (task_id) REFERENCES tasks (id) ON DELETE CASCADE,
    CONSTRAINT fk_task_dependencies_depends_on FOREIGN KEY (depends_on_task_id) REFERENCES tasks (id) ON DELETE CASCADE
    -- self-dependency is rejected in the API (MySQL forbids CHECKs on columns used by FK cascades)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE task_comments (
    id          BIGINT      NOT NULL AUTO_INCREMENT,
    task_id     BIGINT      NOT NULL,
    author_id   BIGINT      NOT NULL,
    body        TEXT        NOT NULL,
    automated   BOOLEAN     NOT NULL DEFAULT FALSE,
    created_at  DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    updated_at  DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
    PRIMARY KEY (id),
    KEY idx_task_comments_task_created (task_id, created_at),
    KEY idx_task_comments_author (author_id),
    CONSTRAINT fk_task_comments_task FOREIGN KEY (task_id) REFERENCES tasks (id) ON DELETE CASCADE,
    CONSTRAINT fk_task_comments_author FOREIGN KEY (author_id) REFERENCES users (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- ── Activity timeline ──────────────────────────────────────────────
CREATE TABLE activities (
    id               BIGINT       NOT NULL AUTO_INCREMENT,
    organization_id  BIGINT       NOT NULL,
    project_id       BIGINT       NULL,
    actor_id         BIGINT       NULL,
    type             VARCHAR(40)  NOT NULL,
    entity_type      VARCHAR(30)  NOT NULL,
    entity_id        BIGINT       NULL,
    summary          VARCHAR(500) NOT NULL,
    metadata         JSON         NULL,
    created_at       DATETIME(6)  NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    PRIMARY KEY (id),
    KEY idx_activities_org_created (organization_id, created_at),
    KEY idx_activities_project_created (project_id, created_at),
    KEY idx_activities_entity (entity_type, entity_id),
    CONSTRAINT fk_activities_org FOREIGN KEY (organization_id) REFERENCES organizations (id),
    CONSTRAINT fk_activities_project FOREIGN KEY (project_id) REFERENCES projects (id) ON DELETE CASCADE,
    CONSTRAINT fk_activities_actor FOREIGN KEY (actor_id) REFERENCES users (id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- ── Workflow automation ────────────────────────────────────────────
CREATE TABLE workflows (
    id               BIGINT       NOT NULL AUTO_INCREMENT,
    organization_id  BIGINT       NOT NULL,
    project_id       BIGINT       NULL,
    name             VARCHAR(120) NOT NULL,
    description      VARCHAR(500) NULL,
    trigger_type     VARCHAR(40)  NOT NULL,
    enabled          BOOLEAN      NOT NULL DEFAULT TRUE,
    created_by       BIGINT       NOT NULL,
    run_count        INT          NOT NULL DEFAULT 0,
    last_run_at      DATETIME(6)  NULL,
    version          BIGINT       NOT NULL DEFAULT 0,
    created_at       DATETIME(6)  NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    updated_at       DATETIME(6)  NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
    PRIMARY KEY (id),
    KEY idx_workflows_org_trigger (organization_id, trigger_type, enabled),
    KEY idx_workflows_project (project_id),
    CONSTRAINT fk_workflows_org FOREIGN KEY (organization_id) REFERENCES organizations (id),
    CONSTRAINT fk_workflows_project FOREIGN KEY (project_id) REFERENCES projects (id) ON DELETE CASCADE,
    CONSTRAINT fk_workflows_creator FOREIGN KEY (created_by) REFERENCES users (id),
    CONSTRAINT chk_workflows_trigger CHECK (trigger_type IN ('TASK_CREATED','TASK_STATUS_CHANGED','TASK_ASSIGNED','COMMENT_ADDED','TASK_OVERDUE'))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE workflow_nodes (
    id           BIGINT      NOT NULL AUTO_INCREMENT,
    workflow_id  BIGINT      NOT NULL,
    node_key     VARCHAR(40) NOT NULL,
    node_type    VARCHAR(20) NOT NULL,
    kind         VARCHAR(40) NOT NULL,
    label        VARCHAR(120) NULL,
    config       JSON        NULL,
    position_x   DOUBLE      NOT NULL DEFAULT 0,
    position_y   DOUBLE      NOT NULL DEFAULT 0,
    PRIMARY KEY (id),
    UNIQUE KEY uk_workflow_nodes_key (workflow_id, node_key),
    CONSTRAINT fk_workflow_nodes_workflow FOREIGN KEY (workflow_id) REFERENCES workflows (id) ON DELETE CASCADE,
    CONSTRAINT chk_workflow_nodes_type CHECK (node_type IN ('TRIGGER','CONDITION','ACTION'))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE workflow_edges (
    id           BIGINT      NOT NULL AUTO_INCREMENT,
    workflow_id  BIGINT      NOT NULL,
    source_key   VARCHAR(40) NOT NULL,
    target_key   VARCHAR(40) NOT NULL,
    branch       VARCHAR(10) NULL,
    PRIMARY KEY (id),
    UNIQUE KEY uk_workflow_edges (workflow_id, source_key, target_key),
    CONSTRAINT fk_workflow_edges_workflow FOREIGN KEY (workflow_id) REFERENCES workflows (id) ON DELETE CASCADE,
    CONSTRAINT chk_workflow_edges_branch CHECK (branch IS NULL OR branch IN ('TRUE','FALSE'))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE workflow_executions (
    id             BIGINT      NOT NULL AUTO_INCREMENT,
    workflow_id    BIGINT      NOT NULL,
    trigger_event  VARCHAR(40) NOT NULL,
    task_id        BIGINT      NULL,
    status         VARCHAR(20) NOT NULL,
    dry_run        BOOLEAN     NOT NULL DEFAULT FALSE,
    steps          JSON        NOT NULL,
    error_message  VARCHAR(500) NULL,
    started_at     DATETIME(6) NOT NULL,
    finished_at    DATETIME(6) NOT NULL,
    duration_ms    INT         NOT NULL,
    PRIMARY KEY (id),
    KEY idx_workflow_executions_workflow_started (workflow_id, started_at),
    KEY idx_workflow_executions_task (task_id),
    KEY idx_workflow_executions_status (status),
    CONSTRAINT fk_workflow_executions_workflow FOREIGN KEY (workflow_id) REFERENCES workflows (id) ON DELETE CASCADE,
    CONSTRAINT fk_workflow_executions_task FOREIGN KEY (task_id) REFERENCES tasks (id) ON DELETE SET NULL,
    CONSTRAINT chk_workflow_executions_status CHECK (status IN ('SUCCESS','FAILED','SKIPPED'))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- ── Notifications ──────────────────────────────────────────────────
CREATE TABLE notifications (
    id          BIGINT       NOT NULL AUTO_INCREMENT,
    user_id     BIGINT       NOT NULL,
    type        VARCHAR(40)  NOT NULL,
    title       VARCHAR(200) NOT NULL,
    body        VARCHAR(500) NULL,
    link        VARCHAR(255) NULL,
    read_at     DATETIME(6)  NULL,
    created_at  DATETIME(6)  NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    PRIMARY KEY (id),
    KEY idx_notifications_user_created (user_id, created_at),
    KEY idx_notifications_user_unread (user_id, read_at),
    CONSTRAINT fk_notifications_user FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- ── Audit log (append-only) ────────────────────────────────────────
CREATE TABLE audit_logs (
    id               BIGINT       NOT NULL AUTO_INCREMENT,
    organization_id  BIGINT       NULL,
    actor_id         BIGINT       NULL,
    actor_email      VARCHAR(190) NULL,
    action           VARCHAR(60)  NOT NULL,
    entity_type      VARCHAR(40)  NOT NULL,
    entity_id        VARCHAR(40)  NULL,
    ip_address       VARCHAR(45)  NULL,
    details          JSON         NULL,
    created_at       DATETIME(6)  NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    PRIMARY KEY (id),
    KEY idx_audit_logs_created (created_at),
    KEY idx_audit_logs_org_created (organization_id, created_at),
    KEY idx_audit_logs_actor (actor_id),
    KEY idx_audit_logs_action (action),
    KEY idx_audit_logs_entity (entity_type, entity_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- ── Platform configuration & API monitoring ────────────────────────
CREATE TABLE system_settings (
    setting_key    VARCHAR(80)  NOT NULL,
    setting_value  VARCHAR(500) NOT NULL,
    value_type     VARCHAR(10)  NOT NULL DEFAULT 'STRING',
    description    VARCHAR(255) NOT NULL,
    updated_by     VARCHAR(190) NULL,
    updated_at     DATETIME(6)  NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
    PRIMARY KEY (setting_key),
    CONSTRAINT chk_system_settings_type CHECK (value_type IN ('STRING','BOOLEAN','NUMBER'))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE api_request_logs (
    id           BIGINT       NOT NULL AUTO_INCREMENT,
    method       VARCHAR(10)  NOT NULL,
    path         VARCHAR(200) NOT NULL,
    status_code  SMALLINT     NOT NULL,
    duration_ms  INT          NOT NULL,
    user_id      BIGINT       NULL,
    created_at   DATETIME(6)  NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    PRIMARY KEY (id),
    KEY idx_api_request_logs_created (created_at),
    KEY idx_api_request_logs_path_created (path, created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
