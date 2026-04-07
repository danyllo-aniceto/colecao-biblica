package backend.repository;

import backend.model.BiblicalCharacter;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Optional;

public interface BiblicalCharacterRepository extends JpaRepository<BiblicalCharacter, Long> {
    Optional<BiblicalCharacter> findByNameIgnoreCase(String name);
}
