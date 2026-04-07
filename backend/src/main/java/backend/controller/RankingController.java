package backend.controller;

import backend.dto.RankingEntryResponse;
import backend.service.RankingService;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

@RestController
@RequestMapping("/ranking")
public class RankingController {

    private final RankingService service;

    public RankingController(RankingService service) {
        this.service = service;
    }

    @GetMapping
    public List<RankingEntryResponse> top50() {
        return service.top50ByScore();
    }
}
