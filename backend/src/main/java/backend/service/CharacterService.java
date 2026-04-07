package backend.service;

import backend.dto.CharacterResponse;
import backend.dto.CreateCharacterRequest;
import backend.dto.UpdateCharacterRequest;
import backend.exception.BadRequestException;
import backend.exception.NotFoundException;
import backend.model.BiblicalCharacter;
import backend.repository.BiblicalCharacterRepository;
import org.springframework.stereotype.Service;

import java.util.List;

@Service
public class CharacterService {

    private final BiblicalCharacterRepository repository;

    public CharacterService(BiblicalCharacterRepository repository) {
        this.repository = repository;
    }

    public CharacterResponse create(CreateCharacterRequest request) {
        repository.findByNameIgnoreCase(request.name()).ifPresent(existing -> {
            throw new BadRequestException("Já existe um personagem com esse nome");
        });

        BiblicalCharacter character = BiblicalCharacter.builder()
                .name(request.name())
                .imageUrl(request.imageUrl())
                .rarity(request.rarity())
                .shortSummary(request.shortSummary())
                .fullDescription(request.fullDescription())
                .bibleBooks(request.bibleBooks())
                .bibleReferences(request.bibleReferences())
                .historicalPeriod(request.historicalPeriod())
                .narrativeRole(request.narrativeRole())
                .genealogy(request.genealogy())
                .curiosities(request.curiosities())
                .importantEvents(request.importantEvents())
                .keyVerses(request.keyVerses())
                .keywords(request.keywords())
                .build();

        return toResponse(repository.save(character));
    }

    public List<CharacterResponse> listAll() {
        return repository.findAll().stream().map(this::toResponse).toList();
    }

    public CharacterResponse findById(Long id) {
        return toResponse(getById(id));
    }

    public CharacterResponse update(Long id, UpdateCharacterRequest request) {
        BiblicalCharacter character = getById(id);

        if (request.name() != null && !request.name().equalsIgnoreCase(character.getName())) {
            repository.findByNameIgnoreCase(request.name()).ifPresent(existing -> {
                throw new BadRequestException("Já existe um personagem com esse nome");
            });
            character.setName(request.name());
        }

        if (request.imageUrl() != null) {
            character.setImageUrl(request.imageUrl());
        }
        if (request.rarity() != null) {
            character.setRarity(request.rarity());
        }
        if (request.shortSummary() != null) {
            character.setShortSummary(request.shortSummary());
        }
        if (request.fullDescription() != null) {
            character.setFullDescription(request.fullDescription());
        }
        if (request.bibleBooks() != null) {
            character.setBibleBooks(request.bibleBooks());
        }
        if (request.bibleReferences() != null) {
            character.setBibleReferences(request.bibleReferences());
        }
        if (request.historicalPeriod() != null) {
            character.setHistoricalPeriod(request.historicalPeriod());
        }
        if (request.narrativeRole() != null) {
            character.setNarrativeRole(request.narrativeRole());
        }
        if (request.genealogy() != null) {
            character.setGenealogy(request.genealogy());
        }
        if (request.curiosities() != null) {
            character.setCuriosities(request.curiosities());
        }
        if (request.importantEvents() != null) {
            character.setImportantEvents(request.importantEvents());
        }
        if (request.keyVerses() != null) {
            character.setKeyVerses(request.keyVerses());
        }
        if (request.keywords() != null) {
            character.setKeywords(request.keywords());
        }

        return toResponse(repository.save(character));
    }

    public void delete(Long id) {
        repository.delete(getById(id));
    }

    public BiblicalCharacter getById(Long id) {
        return repository.findById(id).orElseThrow(() -> new NotFoundException("Personagem não encontrado"));
    }

    public CharacterResponse toResponse(BiblicalCharacter character) {
        return new CharacterResponse(
                character.getId(),
                character.getName(),
                character.getImageUrl(),
                character.getRarity(),
                character.getShortSummary(),
                character.getFullDescription(),
                character.getBibleBooks(),
                character.getBibleReferences(),
                character.getHistoricalPeriod(),
                character.getNarrativeRole(),
                character.getGenealogy(),
                character.getCuriosities(),
                character.getImportantEvents(),
                character.getKeyVerses(),
                character.getKeywords(),
                character.getCreatedAt(),
                character.getCreatedBy(),
                character.getUpdatedAt()
        );
    }
}
