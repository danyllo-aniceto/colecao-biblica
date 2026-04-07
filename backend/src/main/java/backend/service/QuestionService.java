package backend.service;

import backend.dto.CreateQuestionRequest;
import backend.dto.QuestionResponse;
import backend.dto.UpdateQuestionRequest;
import backend.exception.BadRequestException;
import backend.exception.NotFoundException;
import backend.model.BiblicalCharacter;
import backend.model.Question;
import backend.model.QuestionDifficulty;
import backend.repository.QuestionRepository;
import org.springframework.stereotype.Service;

import java.util.Collections;
import java.util.List;

@Service
public class QuestionService {

    private final QuestionRepository repository;
    private final CharacterService characterService;

    public QuestionService(QuestionRepository repository, CharacterService characterService) {
        this.repository = repository;
        this.characterService = characterService;
    }

    public QuestionResponse create(CreateQuestionRequest request) {
        validateCorrectOption(request.correctOption());

        BiblicalCharacter character = null;
        if (request.relatedCharacterId() != null) {
            character = characterService.getById(request.relatedCharacterId());
        }

        int timeLimit = request.timeLimitSeconds() != null
                ? request.timeLimitSeconds()
                : defaultTimeByDifficulty(request.difficulty());

        Question question = Question.builder()
                .text(request.text())
                .difficulty(request.difficulty())
                .timeLimitSeconds(timeLimit)
                .optionA(request.optionA())
                .optionB(request.optionB())
                .optionC(request.optionC())
                .optionD(request.optionD())
                .correctOption(request.correctOption().toUpperCase())
                .relatedCharacter(character)
                .active(request.active() == null || request.active())
                .build();

        return toResponse(repository.save(question));
    }

    public List<QuestionResponse> listAll() {
        return repository.findAll().stream().map(this::toResponse).toList();
    }

    public QuestionResponse findById(Long id) {
        return toResponse(getById(id));
    }

    public QuestionResponse update(Long id, UpdateQuestionRequest request) {
        Question question = getById(id);

        if (request.text() != null) {
            question.setText(request.text());
        }
        if (request.difficulty() != null) {
            question.setDifficulty(request.difficulty());
        }
        if (request.timeLimitSeconds() != null) {
            question.setTimeLimitSeconds(request.timeLimitSeconds());
        }
        if (request.optionA() != null) {
            question.setOptionA(request.optionA());
        }
        if (request.optionB() != null) {
            question.setOptionB(request.optionB());
        }
        if (request.optionC() != null) {
            question.setOptionC(request.optionC());
        }
        if (request.optionD() != null) {
            question.setOptionD(request.optionD());
        }
        if (request.correctOption() != null) {
            validateCorrectOption(request.correctOption());
            question.setCorrectOption(request.correctOption().toUpperCase());
        }

        if (request.relatedCharacterId() != null) {
            question.setRelatedCharacter(characterService.getById(request.relatedCharacterId()));
        }

        if (request.active() != null) {
            question.setActive(request.active());
        }

        return toResponse(repository.save(question));
    }

    public void delete(Long id) {
        repository.delete(getById(id));
    }

    public List<QuestionResponse> randomGeneralQuestions(int requestedLimit) {
        List<Question> questions = repository.findByActiveTrue();
        Collections.shuffle(questions);
        int limit = Math.min(Math.max(requestedLimit, 1), questions.size());
        return questions.stream().limit(limit).map(this::toResponse).toList();
    }

    public List<QuestionResponse> randomCharacterQuestions(Long characterId, int requestedLimit) {
        characterService.getById(characterId);
        List<Question> questions = repository.findByActiveTrueAndRelatedCharacterId(characterId);
        Collections.shuffle(questions);
        int limit = Math.min(Math.max(requestedLimit, 1), questions.size());
        return questions.stream().limit(limit).map(this::toResponse).toList();
    }

    public Question getById(Long id) {
        return repository.findById(id).orElseThrow(() -> new NotFoundException("Pergunta não encontrada"));
    }

    public QuestionResponse toResponse(Question question) {
        return new QuestionResponse(
                question.getId(),
                question.getText(),
                question.getDifficulty(),
                question.getTimeLimitSeconds(),
                question.getOptionA(),
                question.getOptionB(),
                question.getOptionC(),
                question.getOptionD(),
                question.getCorrectOption(),
                question.getRelatedCharacter() != null ? question.getRelatedCharacter().getId() : null,
                question.getRelatedCharacter() != null ? question.getRelatedCharacter().getName() : null,
                question.isActive()
        );
    }

    private int defaultTimeByDifficulty(QuestionDifficulty difficulty) {
        if (difficulty == null) {
            throw new BadRequestException("Dificuldade é obrigatória");
        }

        return switch (difficulty) {
            case EASY -> 30;
            case MEDIUM -> 25;
            case HARD -> 20;
            case VERY_HARD -> 15;
        };
    }

    private void validateCorrectOption(String correctOption) {
        if (correctOption == null) {
            throw new BadRequestException("Alternativa correta é obrigatória");
        }

        String normalized = correctOption.trim().toUpperCase();
        if (!List.of("A", "B", "C", "D").contains(normalized)) {
            throw new BadRequestException("Alternativa correta deve ser A, B, C ou D");
        }
    }
}
