# NEXORA: portfolio, LinkedIn and resume text

Ready-to-use descriptions of the project. Adjust the wording to your own voice before posting.

---

## Portfolio card (short)

**NEXORA: Intelligent Workflow & Collaboration Ecosystem**
A multi-tenant work management platform with Kanban boards, a visual automation builder and explainable project intelligence: health scores, delay forecasts, priority recommendations and workload balancing. Built as a microservice monorepo with a Spring Boot API, a React user app, an Angular admin console, and a Node.js Socket.IO gateway fed by Redis Streams, all behind Nginx in Docker.

`Java 21` `Spring Boot 3.5` `React 19` `TypeScript` `Angular 20` `Node.js` `Socket.IO` `MySQL` `Redis` `Docker` `Nginx` `GitHub Actions`

Links: [Source code](https://github.com/sureshnarayananankumar/nexora)

---

## Portfolio case study (long)

**Problem.** Teams running many projects at once find out about slipping deadlines too late, spend time on repetitive triage, and can't see who is overloaded across projects.

**What I built.**
- **Visual workflow builder:** users drag triggers (task created, status changed, assigned, commented, overdue), conditions and actions onto a canvas. The API validates the graph with Kahn's algorithm, runs each execution in its own transaction, records every step, and supports a dry run against a real task.
- **Explainable insights:** a 0–100 health score built from six capped, named penalty factors, a delivery forecast from 14-day throughput, priority recommendations with stated reasons, and a greedy workload rebalancer. No black-box AI; every number explains itself.
- **Realtime collaboration:** Spring publishes domain events after commit to a Redis Stream. A Node.js Socket.IO gateway consumes them through a consumer group and fans them out to project, user and organisation rooms, with presence and typing indicators.
- **Admin console (Angular):** organisations, users, data-driven roles and permissions, subscription plans with limits enforced by the API, runtime settings, audit logs, and API latency and error monitoring.

**Engineering decisions.**
- Access tokens in memory and rotating HttpOnly refresh cookies with reuse detection, so stolen refresh tokens revoke the whole session family.
- A single Nginx origin keeps cookies `SameSite=Strict` and removes CORS from production.
- Events are published only after commit (`@TransactionalEventListener`), so clients never see changes that later roll back.
- Automation-made changes don't re-trigger workflows, which prevents infinite loops.
- Flyway migrations, Testcontainers integration tests, multi-stage Docker images, and a CI pipeline ending in a `docker compose up` smoke test.

---

## LinkedIn post

> I just published **NEXORA**, an intelligent workflow and collaboration platform I built end to end. 🚀
>
> It's a full microservice monorepo:
> ☕ Spring Boot 3.5 / Java 21 API with JWT + rotating refresh tokens, RBAC and Flyway
> ⚛️ React 19 + TypeScript user app with a drag-and-drop visual workflow builder
> 🅰️ Angular 20 admin console (signals, standalone components)
> 🟢 Node.js Socket.IO gateway fed by Redis Streams for live boards and presence
> 🐳 MySQL, Redis, Nginx, Docker Compose and GitHub Actions CI
>
> The part I'm proudest of is that the "smart" features are explainable. The project health score tells you *which* factors cost points, the forecast shows the velocity it's based on, and every priority suggestion lists its reasons. No black box.
>
> Code, architecture docs and screenshots: https://github.com/sureshnarayananankumar/nexora
>
> #Java #SpringBoot #React #Angular #NodeJS #FullStack #SoftwareEngineering #Microservices

### LinkedIn "Projects" section

**NEXORA: Intelligent Workflow & Collaboration Ecosystem**
Full-stack, multi-tenant work management platform: Spring Boot API, React user app, Angular admin console and a Node.js realtime gateway over Redis Streams, deployed with Docker and Nginx. Features a visual workflow automation engine, explainable project health and risk scoring, priority recommendations, workload balancing, realtime collaboration and enterprise RBAC with audit logging.
Skills: Java · Spring Boot · React.js · Angular · Node.js · TypeScript · MySQL · Redis · Docker · REST APIs · WebSockets

---

## Resume entry

**NEXORA: Intelligent Workflow & Collaboration Platform** | *Java, Spring Boot, React, Angular, Node.js, MySQL, Redis, Docker*
- Designed and built a multi-tenant microservice platform: a Spring Boot REST API (79 endpoints, OpenAPI), React and Angular frontends, and a Node.js Socket.IO gateway, served behind Nginx with Docker Compose.
- Built a visual workflow automation engine with graph validation (cycle and reachability checks), five trigger types, eight actions, transactional execution, step-level history and dry-run testing.
- Created explainable project analytics: a factor-based health score, a throughput-based delivery forecast, priority recommendations and greedy workload rebalancing, each returning human-readable reasons.
- Implemented secure auth with short-lived JWTs, rotating HttpOnly refresh tokens with reuse detection, Redis-backed login rate limiting, RBAC with project-level access and an append-only audit log.
- Delivered realtime collaboration (live boards, presence, typing, notifications) by publishing after-commit domain events to Redis Streams consumed by a Node.js gateway.
- Set up CI/CD with GitHub Actions: unit tests across all four apps, Testcontainers integration tests, and an end-to-end `docker compose` smoke test.
