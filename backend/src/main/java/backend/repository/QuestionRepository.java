package backend.repository;

import backend.model.Question;
import backend.model.QuestionDifficulty;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface QuestionRepository extends JpaRepository<Question, Long> {
    List<Question> findByActiveTrue();
    List<Question> findByActiveTrueAndDifficulty(QuestionDifficulty difficulty);
    List<Question> findByActiveTrueAndRelatedCharacterId(Long relatedCharacterId);
}
