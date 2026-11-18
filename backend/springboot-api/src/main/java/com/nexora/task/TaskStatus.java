package com.nexora.task;

public enum TaskStatus {
    BACKLOG, TODO, IN_PROGRESS, IN_REVIEW, BLOCKED, DONE;

    public boolean isOpen() { return this != DONE; }
}
