package backend.controller;

import backend.dto.UserStickerResponse;
import backend.service.CollectionService;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.Map;

@RestController
@RequestMapping("/collection")
public class CollectionController {

    private final CollectionService service;

    public CollectionController(CollectionService service) {
        this.service = service;
    }

    @GetMapping("/my")
    public java.util.List<UserStickerResponse> myCollection() {
        return service.myCollection();
    }

    @GetMapping("/my/progress")
    public Map<String, Long> myProgress() {
        long owned = service.myStickerCount();
        long total = service.totalCharacterCount();
        return Map.of(
                "owned", owned,
                "total", total
        );
    }
}
