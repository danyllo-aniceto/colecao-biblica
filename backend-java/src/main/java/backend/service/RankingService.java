package backend.service;

import backend.dto.RankingEntryResponse;
import backend.model.User;
import backend.repository.UserRepository;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;
import org.springframework.stereotype.Service;

import java.util.ArrayList;
import java.util.List;

@Service
public class RankingService {

    private final UserRepository userRepository;

    public RankingService(UserRepository userRepository) {
        this.userRepository = userRepository;
    }

    public List<RankingEntryResponse> top50ByScore() {
        List<User> users = userRepository.findByDeletedFalse(
                PageRequest.of(0, 50, Sort.by(Sort.Direction.DESC, "totalScore").and(Sort.by(Sort.Direction.DESC, "xp")))
        ).getContent();

        List<RankingEntryResponse> ranking = new ArrayList<>();
        for (int index = 0; index < users.size(); index++) {
            User user = users.get(index);
            ranking.add(new RankingEntryResponse(
                    index + 1,
                    user.getId(),
                    user.getName(),
                    user.getLevel(),
                    user.getTotalScore(),
                    user.getXp()
            ));
        }

        return ranking;
    }
}
