package backend.controller;

import backend.dto.CreateRewardDefinitionRequest;
import backend.dto.RewardDefinitionResponse;
import backend.dto.UpdateRewardDefinitionRequest;
import backend.service.RewardService;
import jakarta.validation.Valid;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

@RestController
@RequestMapping("/rewards")
public class RewardController {

    private final RewardService service;

    public RewardController(RewardService service) {
        this.service = service;
    }

    @GetMapping
    public List<RewardDefinitionResponse> listAll() {
        return service.listAll();
    }

    @PostMapping("/admin")
    public RewardDefinitionResponse create(@Valid @RequestBody CreateRewardDefinitionRequest request) {
        return service.create(request);
    }

    @PutMapping("/admin/{id}")
    public RewardDefinitionResponse update(@PathVariable Long id, @Valid @RequestBody UpdateRewardDefinitionRequest request) {
        return service.update(id, request);
    }

    @DeleteMapping("/admin/{id}")
    public void delete(@PathVariable Long id) {
        service.delete(id);
    }
}
