package com.nexora.settings;

import io.swagger.v3.oas.annotations.tags.Tag;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/v1/public")
@Tag(name = "Public")
public class PublicConfigController {

    private final SettingsService settings;

    public PublicConfigController(SettingsService settings) {
        this.settings = settings;
    }

    public record PublicConfig(boolean registrationEnabled, String announcement) {
    }

    @GetMapping("/config")
    public PublicConfig config() {
        return new PublicConfig(settings.bool(SettingsService.REGISTRATION_ENABLED, true),
                settings.get(SettingsService.ANNOUNCEMENT, ""));
    }
}
