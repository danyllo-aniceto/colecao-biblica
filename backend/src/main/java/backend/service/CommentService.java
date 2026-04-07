package backend.service;

import backend.dto.CommentResponse;
import backend.dto.CreateCommentRequest;
import backend.dto.UpdateCommentRequest;
import backend.exception.NotFoundException;
import backend.model.BiblicalCharacter;
import backend.model.User;
import backend.model.UserComment;
import backend.repository.UserCommentRepository;
import org.springframework.stereotype.Service;

import java.util.List;

@Service
public class CommentService {

    private final UserCommentRepository repository;
    private final CurrentUserService currentUserService;
    private final CharacterService characterService;

    public CommentService(UserCommentRepository repository,
                          CurrentUserService currentUserService,
                          CharacterService characterService) {
        this.repository = repository;
        this.currentUserService = currentUserService;
        this.characterService = characterService;
    }

    public CommentResponse create(CreateCommentRequest request) {
        User user = currentUserService.getCurrentUser();
        BiblicalCharacter character = characterService.getById(request.characterId());

        UserComment comment = UserComment.builder()
                .user(user)
                .character(character)
                .text(request.text())
                .build();

        return toResponse(repository.save(comment));
    }

    public List<CommentResponse> listMyComments() {
        User user = currentUserService.getCurrentUser();
        return repository.findByUserIdOrderByUpdatedAtDesc(user.getId()).stream().map(this::toResponse).toList();
    }

    public CommentResponse update(Long id, UpdateCommentRequest request) {
        User user = currentUserService.getCurrentUser();
        UserComment comment = repository.findByIdAndUserId(id, user.getId())
                .orElseThrow(() -> new NotFoundException("Comentário não encontrado"));

        comment.setText(request.text());
        return toResponse(repository.save(comment));
    }

    private CommentResponse toResponse(UserComment comment) {
        return new CommentResponse(
                comment.getId(),
                comment.getCharacter().getId(),
                comment.getCharacter().getName(),
                comment.getText(),
                comment.getCreatedAt(),
                comment.getUpdatedAt()
        );
    }
}
