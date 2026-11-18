package com.nexora.task;

import com.nexora.workflow.TriggerType;

/**
 * Raised by user-initiated task changes (never by workflow actions, which prevents automation loops).
 * Consumed after commit by the workflow engine.
 */
public record TaskDomainEvent(TriggerType trigger, Long organizationId, Long projectId, Long taskId, Long actorId,
                              String detail) {
}
