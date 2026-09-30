package backend.repository;

import backend.model.BiblicalCharacter;
import backend.model.StickerRarity;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface BiblicalCharacterRepository extends JpaRepository<BiblicalCharacter, Long> {
    Optional<BiblicalCharacter> findByNameIgnoreCase(String name);
    List<BiblicalCharacter> findByRarity(StickerRarity rarity);
}
