-- ═══════════════════════════════════════════════════════════════════
-- NEXORA · V2 · reference data: plans, permissions, system roles, settings
-- (Demo users/projects are created by the API's DemoDataSeeder when
--  NEXORA_SEED_DEMO=true, so passwords are hashed with BCrypt at runtime.)
-- ═══════════════════════════════════════════════════════════════════

INSERT INTO plans (code, name, description, price_monthly, max_users, max_projects, max_workflows) VALUES
 ('PLATFORM',   'Platform',   'Internal plan for the platform operator',      0.00, 1000, 1000, 1000),
 ('STARTER',    'Starter',    'Small teams getting organised',                0.00,    5,    3,    2),
 ('GROWTH',     'Growth',     'Growing teams that automate their workflow',  49.00,   25,   20,   15),
 ('ENTERPRISE', 'Enterprise', 'Unlimited scale with priority support',      199.00,  500,  500,  200);

INSERT INTO permissions (code, description, category) VALUES
 ('ADMIN_ACCESS',     'Open the platform admin console',               'PLATFORM'),
 ('PLAN_MANAGE',      'Create and edit subscription plans',             'PLATFORM'),
 ('SYSTEM_CONFIG',    'Change platform settings',                       'PLATFORM'),
 ('AUDIT_READ',       'Read audit logs',                                'PLATFORM'),
 ('ROLE_MANAGE',      'Create and edit roles and permissions',          'PLATFORM'),
 ('ORG_MANAGE',       'Edit organisation details',                      'ORGANIZATION'),
 ('USER_MANAGE',      'Invite, update and suspend users',               'ORGANIZATION'),
 ('PROJECT_CREATE',   'Create projects',                                'PROJECT'),
 ('PROJECT_MANAGE',   'Edit projects, members and milestones',          'PROJECT'),
 ('WORKFLOW_MANAGE',  'Create, edit and run workflows',                 'AUTOMATION'),
 ('TASK_WRITE',       'Create, edit and move tasks',                    'WORK'),
 ('COMMENT_WRITE',    'Comment on tasks',                               'WORK'),
 ('ANALYTICS_READ',   'View analytics and insights',                    'WORK');

INSERT INTO roles (name, description, system_role) VALUES
 ('SUPER_ADMIN', 'Platform operator with full access',        TRUE),
 ('ORG_ADMIN',   'Administers one organisation',              TRUE),
 ('MANAGER',     'Plans projects and automates work',         TRUE),
 ('MEMBER',      'Works on tasks and collaborates',           TRUE);

-- SUPER_ADMIN: everything
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM roles r CROSS JOIN permissions p WHERE r.name = 'SUPER_ADMIN';

-- ORG_ADMIN
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM roles r JOIN permissions p
  ON p.code IN ('ORG_MANAGE','USER_MANAGE','PROJECT_CREATE','PROJECT_MANAGE','WORKFLOW_MANAGE','TASK_WRITE','COMMENT_WRITE','ANALYTICS_READ')
WHERE r.name = 'ORG_ADMIN';

-- MANAGER
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM roles r JOIN permissions p
  ON p.code IN ('PROJECT_CREATE','PROJECT_MANAGE','WORKFLOW_MANAGE','TASK_WRITE','COMMENT_WRITE','ANALYTICS_READ')
WHERE r.name = 'MANAGER';

-- MEMBER
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM roles r JOIN permissions p
  ON p.code IN ('TASK_WRITE','COMMENT_WRITE','ANALYTICS_READ')
WHERE r.name = 'MEMBER';

INSERT INTO system_settings (setting_key, setting_value, value_type, description) VALUES
 ('registration.enabled',  'true', 'BOOLEAN', 'Allow new organisations to sign up'),
 ('announcement.banner',   '',     'STRING',  'Message shown at the top of the user app (empty = hidden)'),
 ('insights.stale_days',   '7',    'NUMBER',  'Days without updates before an in-progress task counts as stale'),
 ('workflow.max_steps',    '50',   'NUMBER',  'Maximum steps a single workflow run may execute'),
 ('api_logs.retention_days','7',   'NUMBER',  'How long API request logs are kept for monitoring');

-- Platform tenant for the operator account
INSERT INTO organizations (name, slug, plan_id, industry)
SELECT 'Nexora Platform', 'nexora-platform', id, 'Software' FROM plans WHERE code = 'PLATFORM';
