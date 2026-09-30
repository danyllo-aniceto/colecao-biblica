package backend.controller;

import backend.dto.GameSettingsResponse;
import backend.dto.UpdateGameSettingsRequest;
import backend.service.GameSettingService;
import jakarta.validation.Valid;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/settings")
public class GameSettingController {

    private final GameSettingService service;

    public GameSettingController(GameSettingService service) {
        this.service = service;
    }

    @GetMapping
    public GameSettingsResponse getSettings() {
        return service.getSettings();
    }

    @PutMapping("/admin")
    public GameSettingsResponse updateSettings(@Valid @RequestBody UpdateGameSettingsRequest request) {
        return service.updateSettings(request);
    }
}
