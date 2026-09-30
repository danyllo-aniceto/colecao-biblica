package backend.controller;

import backend.dto.CommentResponse;
import backend.dto.CreateCommentRequest;
import backend.dto.UpdateCommentRequest;
import backend.service.CommentService;
import jakarta.validation.Valid;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

@RestController
@RequestMapping("/comments")
public class CommentController {

    private final CommentService service;

    public CommentController(CommentService service) {
        this.service = service;
    }

    @GetMapping("/my")
    public List<CommentResponse> myComments() {
        return service.listMyComments();
    }

    @PostMapping
    public CommentResponse create(@Valid @RequestBody CreateCommentRequest request) {
        return service.create(request);
    }

    @PutMapping("/{id}")
    public CommentResponse update(@PathVariable Long id, @Valid @RequestBody UpdateCommentRequest request) {
        return service.update(id, request);
    }
}
