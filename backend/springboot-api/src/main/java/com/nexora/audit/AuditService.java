package com.nexora.audit;

import com.nexora.security.AuthUser;
import com.nexora.security.CurrentUser;
import jakarta.servlet.http.HttpServletRequest;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.context.request.RequestContextHolder;
import org.springframework.web.context.request.ServletRequestAttributes;

import java.util.Map;

/** Append-only audit trail for security-relevant and administrative actions. */
@Service
public class AuditService {

    private final AuditLogRepository repo;

    public AuditService(AuditLogRepository repo) {
        this.repo = repo;
    }

    @Transactional(propagation = Propagation.REQUIRES_NEW)
    public void log(String action, String entityType, Object entityId, Map<String, Object> details) {
        AuthUser actor = CurrentUser.find().orElse(null);
        write(actor == null ? null : actor.organizationId(), actor == null ? null : actor.id(),
                actor == null ? null : actor.email(), action, entityType, entityId, details);
    }

    /** For events without an authenticated principal yet (login, registration). */
    @Transactional(propagation = Propagation.REQUIRES_NEW)
    public void logAs(Long orgId, Long actorId, String actorEmail, String action, String entityType, Object entityId,
                      Map<String, Object> details) {
        write(orgId, actorId, actorEmail, action, entityType, entityId, details);
    }

    private void write(Long orgId, Long actorId, String email, String action, String entityType, Object entityId,
                       Map<String, Object> details) {
        AuditLog a = new AuditLog();
        a.setOrganizationId(orgId);
        a.setActorId(actorId);
        a.setActorEmail(email);
        a.setAction(action);
        a.setEntityType(entityType);
        a.setEntityId(entityId == null ? null : String.valueOf(entityId));
        a.setDetails(details);
        a.setIpAddress(clientIp());
        repo.save(a);
    }

    static String clientIp() {
        if (!(RequestContextHolder.getRequestAttributes() instanceof ServletRequestAttributes attrs)) return null;
        HttpServletRequest req = attrs.getRequest();
        // server.forward-headers-strategy=framework already resolves X-Forwarded-For from Nginx
        String ip = req.getRemoteAddr();
        return ip != null && ip.length() > 45 ? ip.substring(0, 45) : ip;
    }
}
