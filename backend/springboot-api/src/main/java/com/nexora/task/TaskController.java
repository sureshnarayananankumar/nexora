package com.nexora.task;

import com.nexora.security.CurrentUser;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/v1")
@Tag(name = "Tasks & comments")
public class TaskController {

    private final TaskService tasks;
    private final CommentService comments;

    public TaskController(TaskService tasks, CommentService comments) {
        this.tasks = tasks;
        this.comments = comments;
    }

    @GetMapping("/projects/{projectId}/tasks")
    @Operation(summary = "All tasks of a project, ordered for the Kanban board")
    public List<TaskDtos.TaskDto> board(@PathVariable Long projectId) {
        return tasks.board(projectId, CurrentUser.get());
    }

    @PostMapping("/projects/{projectId}/tasks")
    @ResponseStatus(HttpStatus.CREATED)
    public TaskDtos.TaskDto create(@PathVariable Long projectId, @Valid @RequestBody TaskDtos.CreateTaskRequest req) {
        return tasks.create(projectId, req, CurrentUser.get());
    }

    @GetMapping("/tasks/mine")
    @Operation(summary = "My open tasks across projects, soonest due first")
    public List<TaskDtos.TaskDto> mine() {
        return tasks.mine(CurrentUser.get());
    }

    @GetMapping("/tasks/{id}")
    public TaskDtos.TaskDto get(@PathVariable Long id) {
        return tasks.get(id, CurrentUser.get());
    }

    @PutMapping("/tasks/{id}")
    @Operation(summary = "Update a task (send the version you loaded for optimistic locking)")
    public TaskDtos.TaskDto update(@PathVariable Long id, @Valid @RequestBody TaskDtos.UpdateTaskRequest req) {
        return tasks.update(id, req, CurrentUser.get());
    }

    @PatchMapping("/tasks/{id}/move")
    @Operation(summary = "Move a card on the board (status + fractional position)")
    public TaskDtos.TaskDto move(@PathVariable Long id, @Valid @RequestBody TaskDtos.MoveTaskRequest req) {
        return tasks.move(id, req, CurrentUser.get());
    }

    @DeleteMapping("/tasks/{id}")
    public ResponseEntity<Void> delete(@PathVariable Long id) {
        tasks.delete(id, CurrentUser.get());
        return ResponseEntity.noContent().build();
    }

    @GetMapping("/tasks/{id}/comments")
    public List<TaskDtos.CommentDto> comments(@PathVariable Long id) {
        return comments.list(id, CurrentUser.get());
    }

    @PostMapping("/tasks/{id}/comments")
    @ResponseStatus(HttpStatus.CREATED)
    public TaskDtos.CommentDto comment(@PathVariable Long id, @Valid @RequestBody TaskDtos.CommentRequest req) {
        return comments.add(id, req, CurrentUser.get());
    }

    @DeleteMapping("/comments/{commentId}")
    public ResponseEntity<Void> deleteComment(@PathVariable Long commentId) {
        comments.delete(commentId, CurrentUser.get());
        return ResponseEntity.noContent().build();
    }
}
