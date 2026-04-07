package backend.controller;

import backend.dto.AuthResponse;
import backend.dto.LoginRequest;
import backend.dto.RefreshRequest;
import backend.exception.NotFoundException;
import backend.exception.UnauthorizedException;
import backend.model.User;
import backend.repository.UserRepository;
import backend.security.JwtUtil;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/auth")
public class AuthController {

    private final UserRepository repository;
    private final PasswordEncoder encoder;
    private final JwtUtil jwtUtil;

    public AuthController(UserRepository repository, PasswordEncoder encoder, JwtUtil jwtUtil) {
        this.repository = repository;
        this.encoder = encoder;
        this.jwtUtil = jwtUtil;
    }

    @PostMapping("/login")
    public AuthResponse login(@RequestBody LoginRequest request) {

        User dbUser = repository.findByEmailAndDeletedFalse(request.email())
                .orElseThrow(() -> new NotFoundException("Usuário não encontrado"));

        if (!encoder.matches(request.password(), dbUser.getPassword())) {
            throw new UnauthorizedException("Senha inválida");
        }

        return buildAuthResponse(dbUser.getEmail());
    }

    @PostMapping("/refresh")
    public AuthResponse refresh(@RequestBody RefreshRequest request) {
        String refreshToken = request.refreshToken();
        String email = jwtUtil.extractEmail(refreshToken);

        User dbUser = repository.findByEmailAndDeletedFalse(email)
                .orElseThrow(() -> new NotFoundException("Usuário não encontrado"));

        if (!jwtUtil.isValidRefreshToken(refreshToken, dbUser.getEmail())) {
            throw new UnauthorizedException("Token de refresh inválido ou expirado");
        }

        return buildAuthResponse(dbUser.getEmail());
    }

    private AuthResponse buildAuthResponse(String email) {
        return new AuthResponse(
                jwtUtil.generateAccessToken(email),
                jwtUtil.generateRefreshToken(email)
        );
    }
}