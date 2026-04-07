package backend.service;

import backend.dto.UserStickerResponse;
import backend.model.BiblicalCharacter;
import backend.model.User;
import backend.model.UserSticker;
import backend.repository.BiblicalCharacterRepository;
import backend.repository.UserStickerRepository;
import org.springframework.stereotype.Service;

import java.time.Instant;
import java.util.List;

@Service
public class CollectionService {

    private final UserStickerRepository userStickerRepository;
    private final BiblicalCharacterRepository characterRepository;
    private final CurrentUserService currentUserService;

    public CollectionService(UserStickerRepository userStickerRepository,
                             BiblicalCharacterRepository characterRepository,
                             CurrentUserService currentUserService) {
        this.userStickerRepository = userStickerRepository;
        this.characterRepository = characterRepository;
        this.currentUserService = currentUserService;
    }

    public List<UserStickerResponse> myCollection() {
        User user = currentUserService.getCurrentUser();
        return userStickerRepository.findByUserId(user.getId()).stream()
                .map(this::toResponse)
                .toList();
    }

    public void grantStickerIfMissing(User user, BiblicalCharacter character) {
        userStickerRepository.findByUserIdAndCharacterId(user.getId(), character.getId())
                .orElseGet(() -> userStickerRepository.save(UserSticker.builder()
                        .user(user)
                        .character(character)
                        .acquiredAt(Instant.now())
                        .build()));
    }

    public long totalCharacterCount() {
        return characterRepository.count();
    }

    public long myStickerCount() {
        User user = currentUserService.getCurrentUser();
        return userStickerRepository.countByUserId(user.getId());
    }

    private UserStickerResponse toResponse(UserSticker sticker) {
        return new UserStickerResponse(
                sticker.getCharacter().getId(),
                sticker.getCharacter().getName(),
                sticker.getCharacter().getImageUrl(),
                sticker.getCharacter().getRarity(),
                sticker.getAcquiredAt()
        );
    }
}
