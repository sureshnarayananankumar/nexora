package com.nexora.organization;

import com.nexora.common.ApiException;
import com.nexora.plan.Plan;
import com.nexora.project.ProjectRepository;
import com.nexora.user.UserRepository;
import com.nexora.workflow.WorkflowRepository;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Component;

/** Enforces the organisation's subscription limits before creating limited resources. */
@Component
public class PlanLimits {

    private final OrganizationRepository orgs;
    private final UserRepository users;
    private final ProjectRepository projects;
    private final WorkflowRepository workflows;

    public PlanLimits(OrganizationRepository orgs, UserRepository users, ProjectRepository projects,
                      WorkflowRepository workflows) {
        this.orgs = orgs;
        this.users = users;
        this.projects = projects;
        this.workflows = workflows;
    }

    public record Usage(long users, long projects, long workflows) {
    }

    public Usage usage(Long orgId) {
        return new Usage(users.countByOrganizationId(orgId),
                projects.countByOrganizationIdAndStatusNot(orgId, "ARCHIVED"),
                workflows.countByOrganizationId(orgId));
    }

    public void checkUsers(Long orgId) {
        Plan plan = plan(orgId);
        if (users.countByOrganizationId(orgId) >= plan.getMaxUsers()) {
            throw limit("users", plan);
        }
    }

    public void checkProjects(Long orgId) {
        Plan plan = plan(orgId);
        if (projects.countByOrganizationIdAndStatusNot(orgId, "ARCHIVED") >= plan.getMaxProjects()) {
            throw limit("active projects", plan);
        }
    }

    public void checkWorkflows(Long orgId) {
        Plan plan = plan(orgId);
        if (workflows.countByOrganizationId(orgId) >= plan.getMaxWorkflows()) {
            throw limit("workflows", plan);
        }
    }

    private Plan plan(Long orgId) {
        return orgs.findById(orgId).orElseThrow(() -> ApiException.notFound("Organization")).getPlan();
    }

    private static ApiException limit(String what, Plan plan) {
        return new ApiException(HttpStatus.PAYMENT_REQUIRED, "PLAN_LIMIT_REACHED",
                "Your " + plan.getName() + " plan allows " + switch (what) {
                    case "users" -> plan.getMaxUsers();
                    case "active projects" -> plan.getMaxProjects();
                    default -> plan.getMaxWorkflows();
                } + " " + what + ". Upgrade to add more.");
    }
}
