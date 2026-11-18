package com.nexora.it;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.Tag;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.web.client.TestRestTemplate;
import org.springframework.boot.testcontainers.service.connection.ServiceConnection;
import org.springframework.http.*;
import org.testcontainers.containers.GenericContainer;
import org.testcontainers.containers.MySQLContainer;
import org.testcontainers.junit.jupiter.Container;
import org.testcontainers.junit.jupiter.Testcontainers;

import java.time.LocalDate;
import java.util.List;
import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * End-to-end API flow against real MySQL and Redis containers:
 * register → project → workflow → task (workflow fires) → execution history → insights → RBAC → refresh rotation.
 * Run with: mvn verify -Pintegration (needs Docker).
 */
@Tag("integration")
@Testcontainers
@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT, properties = {
        "nexora.jwt.secret=integration-test-secret-integration-test-secret",
        "spring.flyway.locations=filesystem:../../database/migrations"
})
class ApiFlowIT {

    @Container
    @ServiceConnection
    static MySQLContainer<?> mysql = new MySQLContainer<>("mysql:8.4");

    @Container
    @ServiceConnection(name = "redis")
    static GenericContainer<?> redis = new GenericContainer<>("redis:7.4-alpine").withExposedPorts(6379);

    @Autowired
    TestRestTemplate http;

    @Autowired
    ObjectMapper mapper;

    private HttpHeaders auth(String token) {
        HttpHeaders h = new HttpHeaders();
        h.setContentType(MediaType.APPLICATION_JSON);
        h.setBearerAuth(token);
        return h;
    }

    private JsonNode call(HttpMethod method, String url, Object body, String token, HttpStatus expected) throws Exception {
        ResponseEntity<String> res = http.exchange(url, method, new HttpEntity<>(body, auth(token)), String.class);
        assertThat(res.getStatusCode()).as(method + " " + url + " → " + res.getBody()).isEqualTo(expected);
        return res.getBody() == null ? null : mapper.readTree(res.getBody());
    }

    @Test
    void fullFlow() throws Exception {
        // register
        HttpHeaders json = new HttpHeaders();
        json.setContentType(MediaType.APPLICATION_JSON);
        ResponseEntity<String> reg = http.postForEntity("/api/v1/auth/register", new HttpEntity<>(Map.of(
                "fullName", "Ivy Tester", "email", "ivy@it.dev", "password", "Passw0rd!x", "organizationName", "IT Corp"), json), String.class);
        assertThat(reg.getStatusCode()).isEqualTo(HttpStatus.CREATED);
        String token = mapper.readTree(reg.getBody()).get("accessToken").asText();
        String cookie = reg.getHeaders().getFirst(HttpHeaders.SET_COOKIE);
        assertThat(cookie).contains("nexora_rt=").contains("HttpOnly").contains("SameSite=Strict");

        // project
        JsonNode project = call(HttpMethod.POST, "/api/v1/projects", Map.of("key", "ITP", "name", "Integration",
                "color", "#6366F1", "startDate", LocalDate.now().minusDays(5).toString(),
                "dueDate", LocalDate.now().plusDays(20).toString()), token, HttpStatus.CREATED);
        long projectId = project.get("project").get("id").asLong();

        // workflow: new unassigned tasks become CRITICAL
        JsonNode wf = call(HttpMethod.POST, "/api/v1/workflows", Map.of("name", "Escalate unowned", "projectId", projectId,
                "enabled", true,
                "nodes", List.of(
                        Map.of("key", "t", "type", "TRIGGER", "kind", "TASK_CREATED", "label", "Created", "config", Map.of(), "x", 0, "y", 0),
                        Map.of("key", "c", "type", "CONDITION", "kind", "IS_UNASSIGNED", "label", "Unassigned", "config", Map.of(), "x", 200, "y", 0),
                        Map.of("key", "a", "type", "ACTION", "kind", "SET_PRIORITY", "label", "Critical", "config", Map.of("priority", "CRITICAL"), "x", 400, "y", 0)),
                "edges", List.of(Map.of("source", "t", "target", "c"), Map.of("source", "c", "target", "a", "branch", "TRUE"))),
                token, HttpStatus.CREATED);
        long workflowId = wf.get("workflow").get("id").asLong();

        // invalid workflow is rejected with an explanation
        JsonNode bad = call(HttpMethod.POST, "/api/v1/workflows", Map.of("name", "Broken", "projectId", projectId, "enabled", true,
                "nodes", List.of(Map.of("key", "a", "type", "ACTION", "kind", "SET_PRIORITY", "config", Map.of("priority", "LOW"), "x", 0, "y", 0),
                        Map.of("key", "b", "type", "ACTION", "kind", "SET_PRIORITY", "config", Map.of("priority", "LOW"), "x", 0, "y", 0)),
                "edges", List.of()), token, HttpStatus.BAD_REQUEST);
        assertThat(bad.get("code").asText()).isEqualTo("INVALID_WORKFLOW");

        // task → workflow fires after commit
        JsonNode task = call(HttpMethod.POST, "/api/v1/projects/" + projectId + "/tasks", Map.of("title", "Write docs",
                "priority", "LOW", "storyPoints", 3), token, HttpStatus.CREATED);
        long taskId = task.get("id").asLong();
        assertThat(task.get("key").asText()).isEqualTo("ITP-1");
        JsonNode reloaded = call(HttpMethod.GET, "/api/v1/tasks/" + taskId, null, token, HttpStatus.OK);
        assertThat(reloaded.get("priority").asText()).isEqualTo("CRITICAL");

        JsonNode runs = call(HttpMethod.GET, "/api/v1/workflows/" + workflowId + "/executions", null, token, HttpStatus.OK);
        assertThat(runs.get("content").get(0).get("status").asText()).isEqualTo("SUCCESS");

        // optimistic locking: stale version is rejected
        call(HttpMethod.PUT, "/api/v1/tasks/" + taskId, Map.of("title", "x", "status", "TODO", "priority", "LOW",
                "version", 0), token, HttpStatus.CONFLICT);

        // move + insights
        call(HttpMethod.PATCH, "/api/v1/tasks/" + taskId + "/move", Map.of("status", "IN_PROGRESS", "position", 512.5), token, HttpStatus.OK);
        JsonNode health = call(HttpMethod.GET, "/api/v1/projects/" + projectId + "/insights/health", null, token, HttpStatus.OK);
        assertThat(health.get("score").asInt()).isBetween(0, 100);
        assertThat(health.get("factors")).hasSize(6);

        // a member can't reach the admin API
        call(HttpMethod.GET, "/api/v1/admin/overview", null, token, HttpStatus.FORBIDDEN);
        // and unauthenticated calls get 401
        assertThat(http.getForEntity("/api/v1/projects", String.class).getStatusCode()).isEqualTo(HttpStatus.UNAUTHORIZED);

        // refresh rotates the cookie; replaying the old one revokes the session family
        HttpHeaders withCookie = new HttpHeaders();
        withCookie.add(HttpHeaders.COOKIE, cookie.split(";")[0]);
        ResponseEntity<String> refreshed = http.exchange("/api/v1/auth/refresh", HttpMethod.POST, new HttpEntity<>(null, withCookie), String.class);
        assertThat(refreshed.getStatusCode()).isEqualTo(HttpStatus.OK);
        ResponseEntity<String> replay = http.exchange("/api/v1/auth/refresh", HttpMethod.POST, new HttpEntity<>(null, withCookie), String.class);
        assertThat(replay.getStatusCode()).isEqualTo(HttpStatus.UNAUTHORIZED);
        HttpHeaders newCookie = new HttpHeaders();
        newCookie.add(HttpHeaders.COOKIE, refreshed.getHeaders().getFirst(HttpHeaders.SET_COOKIE).split(";")[0]);
        ResponseEntity<String> afterReuse = http.exchange("/api/v1/auth/refresh", HttpMethod.POST, new HttpEntity<>(null, newCookie), String.class);
        assertThat(afterReuse.getStatusCode()).isEqualTo(HttpStatus.UNAUTHORIZED);
    }
}
