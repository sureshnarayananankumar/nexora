package com.nexora.project;

import com.nexora.common.ApiException;
import com.nexora.security.AuthUser;
import org.springframework.stereotype.Component;

import java.util.List;
import java.util.Optional;

/** Central place for "can this user do X in this project" rules. */
@Component
public class ProjectAccess {

    public enum Level { READ, WRITE, MANAGE }

    private final ProjectRepository projects;
    private final ProjectMemberRepository members;

    public ProjectAccess(ProjectRepository projects, ProjectMemberRepository members) {
        this.projects = projects;
        this.members = members;
    }

    /** Loads the project in the caller's organisation and checks the access level, or throws 404/403. */
    public Project require(Long projectId, AuthUser user, Level level) {
        Project p = projects.findByIdAndOrganizationId(projectId, user.organizationId())
                .orElseThrow(() -> ApiException.notFound("Project"));
        Optional<ProjectMember> membership = members.findById(new ProjectMemberId(p.getId(), user.id()));
        boolean orgWide = user.seesAllOrgProjects();
        if (!orgWide && membership.isEmpty()) {
            throw ApiException.notFound("Project");
        }
        String projectRole = membership.map(ProjectMember::getProjectRole).orElse(null);
        switch (level) {
            case READ -> { }
            case WRITE -> {
                if (!user.can("TASK_WRITE") || (!orgWide && "VIEWER".equals(projectRole))) {
                    throw ApiException.forbidden("You have read-only access to this project");
                }
            }
            case MANAGE -> {
                boolean allowed = user.can("PROJECT_MANAGE")
                        && (orgWide || "OWNER".equals(projectRole) || user.role().equals("MANAGER"));
                if (!allowed) throw ApiException.forbidden("Only project owners and managers can change this project");
            }
        }
        if ("ARCHIVED".equals(p.getStatus()) && level == Level.WRITE) {
            throw ApiException.badRequest("PROJECT_ARCHIVED", "This project is archived. Restore it to make changes.");
        }
        return p;
    }

    public List<Project> visibleProjects(AuthUser user) {
        return user.seesAllOrgProjects()
                ? projects.findByOrganizationIdAndStatusNotOrderByNameAsc(user.organizationId(), "ARCHIVED")
                : projects.findVisibleForMember(user.organizationId(), user.id());
    }

    public List<Long> visibleProjectIds(AuthUser user) {
        return visibleProjects(user).stream().map(Project::getId).toList();
    }

    public String roleOf(Long projectId, Long userId) {
        return members.findById(new ProjectMemberId(projectId, userId)).map(ProjectMember::getProjectRole).orElse(null);
    }
}
