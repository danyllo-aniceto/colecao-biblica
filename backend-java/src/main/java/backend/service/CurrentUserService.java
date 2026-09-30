package backend.service;

import backend.exception.NotFoundException;
import backend.exception.UnauthorizedException;
import backend.model.User;
import backend.repository.UserRepository;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Service;

@Service
public class CurrentUserService {

    private final UserRepository userRepository;

    public CurrentUserService(UserRepository userRepository) {
        this.userRepository = userRepository;
    }

    public User getCurrentUser() {
        Authentication authentication = SecurityContextHolder.getContext().getAuthentication();
        if (authentication == null || !authentication.isAuthenticated()) {
            throw new UnauthorizedException("Usuário não autenticado");
        }

        String email = authentication.getName();
        return userRepository.findByEmailAndDeletedFalse(email)
                .orElseThrow(() -> new NotFoundException("Usuário não encontrado"));
    }
}
