package com.nexora.task;

public enum TaskPriority {
    LOW(0), MEDIUM(1), HIGH(2), CRITICAL(3);

    private final int rank;

    TaskPriority(int rank) { this.rank = rank; }

    public int rank() { return rank; }

    public boolean atLeast(TaskPriority other) { return rank >= other.rank; }
}
