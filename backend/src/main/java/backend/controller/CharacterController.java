package backend.controller;

import backend.dto.CharacterResponse;
import backend.dto.CreateCharacterRequest;
import backend.dto.UpdateCharacterRequest;
import backend.service.CharacterService;
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
@RequestMapping("/characters")
public class CharacterController {

    private final CharacterService service;

    public CharacterController(CharacterService service) {
        this.service = service;
    }

    @GetMapping
    public List<CharacterResponse> listAll() {
        return service.listAll();
    }

    @GetMapping("/{id}")
    public CharacterResponse byId(@PathVariable Long id) {
        return service.findById(id);
    }

    @PostMapping("/admin")
    public CharacterResponse create(@Valid @RequestBody CreateCharacterRequest request) {
        return service.create(request);
    }

    @PutMapping("/admin/{id}")
    public CharacterResponse update(@PathVariable Long id, @Valid @RequestBody UpdateCharacterRequest request) {
        return service.update(id, request);
    }

    @DeleteMapping("/admin/{id}")
    public void delete(@PathVariable Long id) {
        service.delete(id);
    }
}
