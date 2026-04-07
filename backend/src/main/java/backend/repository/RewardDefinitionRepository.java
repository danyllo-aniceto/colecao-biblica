package backend.repository;

import backend.model.RewardDefinition;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface RewardDefinitionRepository extends JpaRepository<RewardDefinition, Long> {
    List<RewardDefinition> findByActiveTrue();
}
