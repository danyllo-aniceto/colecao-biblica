package backend.controller;

import backend.dto.CreateQuestionRequest;
import backend.dto.QuestionResponse;
import backend.dto.UpdateQuestionRequest;
import backend.service.QuestionService;
import jakarta.validation.Valid;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

@RestController
@RequestMapping("/questions")
public class QuestionController {

    private final QuestionService service;

    public QuestionController(QuestionService service) {
        this.service = service;
    }

    @GetMapping
    public List<QuestionResponse> listAll() {
        return service.listAll();
    }

    @GetMapping("/{id}")
    public QuestionResponse byId(@PathVariable Long id) {
        return service.findById(id);
    }

    @GetMapping("/general/random")
    public List<QuestionResponse> randomGeneral(@RequestParam(defaultValue = "10") int limit) {
        return service.randomGeneralQuestions(limit);
    }

    @GetMapping("/characters/{characterId}/random")
    public List<QuestionResponse> randomByCharacter(@PathVariable Long characterId,
                                                    @RequestParam(defaultValue = "10") int limit) {
        return service.randomCharacterQuestions(characterId, limit);
    }

    @PostMapping("/admin")
    public QuestionResponse create(@Valid @RequestBody CreateQuestionRequest request) {
        return service.create(request);
    }

    @PutMapping("/admin/{id}")
    public QuestionResponse update(@PathVariable Long id, @Valid @RequestBody UpdateQuestionRequest request) {
        return service.update(id, request);
    }

    @DeleteMapping("/admin/{id}")
    public void delete(@PathVariable Long id) {
        service.delete(id);
    }
}
