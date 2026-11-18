package com.nexora.organization;

import com.nexora.audit.AuditService;
import com.nexora.common.ApiException;
import com.nexora.common.Jsons;
import com.nexora.security.CurrentUser;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.*;

import java.math.BigDecimal;

@RestController
@RequestMapping("/api/v1/organization")
@Tag(name = "Organisation")
public class OrganizationController {

    private final OrganizationRepository orgs;
    private final PlanLimits limits;
    private final AuditService audit;

    public OrganizationController(OrganizationRepository orgs, PlanLimits limits, AuditService audit) {
        this.orgs = orgs;
        this.limits = limits;
        this.audit = audit;
    }

    public record PlanDto(String code, String name, BigDecimal priceMonthly, int maxUsers, int maxProjects, int maxWorkflows) {
    }

    public record OrgDto(Long id, String name, String slug, String industry, String status, PlanDto plan,
                         PlanLimits.Usage usage) {
    }

    public record UpdateOrgRequest(@NotBlank @Size(min = 2, max = 120) String name, @Size(max = 80) String industry) {
    }

    @GetMapping
    @Transactional(readOnly = true)
    public OrgDto current() {
        Organization o = orgs.findById(CurrentUser.get().organizationId()).orElseThrow(() -> ApiException.notFound("Organization"));
        return toDto(o);
    }

    @PutMapping
    @PreAuthorize("hasAuthority('ORG_MANAGE')")
    @Transactional
    public OrgDto update(@Valid @RequestBody UpdateOrgRequest req) {
        Organization o = orgs.findById(CurrentUser.get().organizationId()).orElseThrow(() -> ApiException.notFound("Organization"));
        String before = o.getName();
        o.setName(req.name().trim());
        o.setIndustry(req.industry() == null || req.industry().isBlank() ? null : req.industry().trim());
        audit.log("ORG_UPDATED", "ORGANIZATION", o.getId(), Jsons.map("from", before, "to", o.getName()));
        return toDto(o);
    }

    private OrgDto toDto(Organization o) {
        var p = o.getPlan();
        return new OrgDto(o.getId(), o.getName(), o.getSlug(), o.getIndustry(), o.getStatus(),
                new PlanDto(p.getCode(), p.getName(), p.getPriceMonthly(), p.getMaxUsers(), p.getMaxProjects(), p.getMaxWorkflows()),
                limits.usage(o.getId()));
    }
}
