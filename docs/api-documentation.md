# NEXORA API reference

The Spring Boot API serves everything under `/api/v1`. With the stack running, the interactive OpenAPI docs are at:

- Swagger UI: `http://localhost:8088/api/swagger-ui.html`
- OpenAPI JSON: `http://localhost:8088/api/v3/api-docs`

This page summarises the contract. Swagger is generated from the code and is the source of truth.

## Conventions

| Topic | Rule |
|---|---|
| Auth | `Authorization: Bearer <accessToken>` on every route except `/auth/*` and `/public/*`. Access tokens live 15 minutes. |
| Refresh | `POST /auth/refresh` reads the HttpOnly cookie (`nexora_rt`, or `nexora_admin_rt` when the request sends `X-Client: admin`). Each refresh rotates the token; replaying an old one revokes every session of that user. |
| Errors | `{ "code": "TASK_NOT_FOUND", "message": "…", "status": 404, "path": "…", "timestamp": "…", "fieldErrors": [ { "field", "message" } ] }` |
| Pagination | Paged lists take `page` (0-based) and `size`, and return `{ content, page, size, totalElements, totalPages }`. Admin lists also take filters and `sort`. |
| Plan limits | Creating a seat, project or workflow above the organisation's plan returns `402 PLAN_LIMIT_REACHED`. |
| Rate limit | Repeated failed logins for one email + IP return `429 TOO_MANY_ATTEMPTS`. |
| Tenancy | Every non-admin query is scoped to the caller's organisation. Project routes also check project membership (READ / WRITE / MANAGE). |

## Endpoints

Permission codes are listed in the RBAC table in [architecture.md](architecture.md#7-rbac).

### Auth and profile

| Method | Path | Notes |
|---|---|---|
| POST | `/auth/register` | Creates an organisation (Starter plan) and its ORG_ADMIN. Can be switched off with the `registration.enabled` setting. |
| POST | `/auth/login` | Returns `{ accessToken, expiresIn, user }` and sets the refresh cookie. |
| POST | `/auth/refresh` | Rotates the refresh cookie and returns a new access token. |
| POST | `/auth/logout` | Revokes the current refresh token and clears the cookie. |
| GET / PUT | `/me` | Your profile (name, job title, time zone, weekly capacity, avatar colour). |
| PUT | `/me/preferences` | Theme and dashboard widget layout. |
| PUT | `/me/password` | Requires the current password; revokes your other sessions. |
| GET | `/public/config` | Announcement banner and whether registration is open. |

### Organisation and team

| Method | Path | Permission |
|---|---|---|
| GET / PUT | `/organization` | GET: any member · PUT: ORG_MANAGE |
| GET | `/team` | Members with live workload (open points ÷ weekly capacity). |
| POST | `/team` | USER_MANAGE. Returns a one-time temporary password. Checks the seat limit. |
| PUT | `/team/{id}` | USER_MANAGE. Changes role, job title, capacity or status. |

### Projects, milestones, members

| Method | Path | Access |
|---|---|---|
| GET / POST | `/projects` | POST needs PROJECT_CREATE and checks the plan limit. |
| GET / PUT | `/projects/{id}` | READ / MANAGE |
| POST | `/projects/{id}/members` | MANAGE |
| PUT / DELETE | `/projects/{id}/members/{userId}` | MANAGE |
| POST | `/projects/{id}/milestones` | WRITE |
| PUT / DELETE | `/projects/{id}/milestones/{milestoneId}` | WRITE |

### Tasks and comments

| Method | Path | Notes |
|---|---|---|
| GET | `/projects/{projectId}/tasks` | Full board: tasks ordered by status and position. |
| POST | `/projects/{projectId}/tasks` | Fires the `TASK_CREATED` (and `TASK_ASSIGNED`) workflow triggers. |
| GET | `/tasks/mine` | Your open tasks across all projects. |
| GET / PUT / DELETE | `/tasks/{id}` | PUT takes optional fields. `dependsOn` rejects self-references and cycles (`DEPENDENCY_CYCLE`). |
| PATCH | `/tasks/{id}/move` | `{ status, position }`; reorders the column in one transaction. |
| GET / POST | `/tasks/{id}/comments` | Fires the `COMMENT_ADDED` workflow trigger. |
| DELETE | `/comments/{commentId}` | Author, or project MANAGE. |

### Insights (explainable algorithms)

| Method | Path | Returns |
|---|---|---|
| GET | `/projects/{id}/insights/health` | `score`, `risk`, `factors[] { code, penalty, detail }`, `forecast { velocityPerDay, projectedFinish, daysLate }`. Cached for 60 s. |
| GET | `/projects/{id}/insights/priorities` | Ranked tasks with `score`, `suggestedPriority` and `reasons[]`. |
| POST | `/projects/{id}/insights/priorities/{taskId}/apply` | Applies the suggested priority. |
| GET | `/projects/{id}/insights/workload` | Load per member plus greedy rebalance `suggestions[]`. |
| POST | `/projects/{id}/insights/workload/apply` | `{ taskId, toUserId }` |
| GET | `/insights/portfolio` | Health of every project you can see, riskiest first. |

### Workflows

| Method | Path | Notes |
|---|---|---|
| GET | `/workflows/catalog` | Triggers, conditions and actions, with their config schema. Drives the builder palette. |
| GET / POST | `/workflows` | POST validates the graph (cycles, reachability, config) and checks the plan limit. |
| GET / PUT / DELETE | `/workflows/{id}` | WORKFLOW_MANAGE for writes. |
| PATCH | `/workflows/{id}/enabled` | `{ enabled }` |
| POST | `/workflows/{id}/test` | Dry run against a real task: `{ taskId }`. Returns the step trace and writes nothing. |
| GET | `/workflows/{id}/executions` · `/workflows/executions` | Execution history with per-step status and timing. |

### Activity, notifications, analytics

| Method | Path | Notes |
|---|---|---|
| GET | `/activities?projectId=&taskId=&page=&size=` | Activity timeline, newest first. |
| GET | `/notifications` · `/notifications/unread-count` | |
| POST | `/notifications/{id}/read` · `/notifications/read-all` | |
| GET | `/analytics/overview?projectId=&weeks=` | Throughput, status mix, utilisation, cycle time and automation volume. |
| GET | `/calendar?from=&to=&projectId=` | Task due dates and milestones. |

### Admin console (`ADMIN_ACCESS` plus the listed permission)

| Method | Path | Permission |
|---|---|---|
| GET | `/admin/overview` · `/admin/analytics/daily?days=` | ADMIN_ACCESS |
| GET | `/admin/users` · PUT `/admin/users/{id}` · POST `/admin/users/{id}/revoke-sessions` | USER_MANAGE |
| GET | `/admin/organizations` · GET/PUT `/admin/organizations/{id}` | ORG_MANAGE |
| GET | `/admin/roles` · `/admin/permissions` · POST/PUT/DELETE `/admin/roles[/{id}]` | ROLE_MANAGE (system roles cannot be deleted) |
| GET | `/admin/plans` · POST/PUT `/admin/plans[/{id}]` | PLAN_MANAGE |
| GET | `/admin/projects` | ADMIN_ACCESS |
| GET | `/admin/audit-logs` · `/admin/audit-logs/actions` | AUDIT_READ |
| GET | `/admin/settings` · PUT `/admin/settings/{key}` | SYSTEM_CONFIG |
| GET | `/admin/api-metrics?hours=` | ADMIN_ACCESS |

79 routes in total. Each one maps to a client call in the React or Angular app; this was checked with a script during development.

## Realtime gateway (Socket.IO)

Connect with Socket.IO path `/socket.io` (Nginx proxies it to the gateway) and `auth: { token: <accessToken> }`. On connect, a socket joins `user:{id}` and `org:{id}`.

| Direction | Event | Payload |
|---|---|---|
| client → server | `project:join` | `{ projectId }`, with an ack `{ ok }`. Membership is checked against the API using the caller's own token. |
| client → server | `project:leave` | `{ projectId }` |
| client → server | `typing` | `{ projectId, taskId, typing }` |
| server → client | `presence:project` / `presence:org` | `{ users[] }` |
| server → client | `typing` | `{ projectId, taskId, typing, user }` |
| server → client | domain events | `task.created`, `task.updated`, `task.deleted`, `comment.created`, `comment.deleted`, `activity.created`, `notification.created`, `workflow.executed`, `project.changed` |

The API writes domain events to the Redis Stream `nexora:events` after each transaction commits. The gateway reads them with the consumer group `realtime`, sends each one to the matching room, and acknowledges it.

Gateway endpoints: `GET /health` is public inside the Docker network (used by the healthcheck). `GET /metrics` needs a JWT with `ADMIN_ACCESS`; Nginx exposes it as `/realtime/metrics`.
