package backend.service;

import backend.dto.CreateUserRequest;
import backend.dto.UpdateUserRequest;
import backend.dto.UserResponse;
import backend.exception.BadRequestException;
import backend.exception.ForbiddenException;
import backend.exception.NotFoundException;
import backend.model.User;
import backend.repository.UserRepository;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.domain.Specification;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;

import java.time.Instant;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.core.GrantedAuthority;

import java.util.List;
import java.util.Locale;
import java.util.Objects;

@Service
public class UserService {

    private final UserRepository repository;
    private final PasswordEncoder encoder;

    public UserService(UserRepository repository, PasswordEncoder encoder) {
        this.repository = repository;
        this.encoder = encoder;
    }

    public UserResponse create(CreateUserRequest request) {
        if (repository.findByEmailAndDeletedFalse(request.email()).isPresent()) {
            throw new BadRequestException("E-mail já cadastrado");
        }

        User user = User.builder()
                .name(request.name())
                .email(request.email())
                .password(encoder.encode(request.password()))
                .role(request.role() != null ? request.role() : backend.model.Role.USER)
                .createdBy(resolveCurrentAuditor(request.email()))
                .updatedBy(resolveCurrentAuditor(request.email()))
                .build();

        User savedUser = repository.save(user);
        return toResponse(savedUser);
    }

    public Page<UserResponse> listAll(Pageable pageable, String name, String email, String role) {
        Specification<User> specification = Specification.where(notDeleted())
                .and(containsName(name))
                .and(containsEmail(email))
                .and(hasRole(role));

        return repository.findAll(specification, pageable).map(this::toResponse);
    }

    public List<UserResponse> listAll() {
        return repository.findAllByDeletedFalse().stream()
                .map(this::toResponse)
                .toList();
    }

    public UserResponse findById(Long id) {
        return toResponse(getUserById(id));
    }

    public UserResponse update(Long id, UpdateUserRequest request) {
        User user = getUserById(id);
        ensureOwnerOrAdmin(user);

        if (request.email() != null && !request.email().equals(user.getEmail())) {
            repository.findByEmailAndDeletedFalse(request.email())
                    .filter(existing -> !existing.getId().equals(user.getId()))
                    .ifPresent(existing -> {
                        throw new BadRequestException("E-mail já cadastrado");
                    });
            user.setEmail(request.email());
        }

        if (request.name() != null) {
            user.setName(request.name());
        }

        if (request.password() != null && !request.password().isBlank()) {
            user.setPassword(encoder.encode(request.password()));
        }

        if (request.role() != null) {
            user.setRole(request.role());
        }

        user.setUpdatedBy(resolveCurrentAuditor(user.getEmail()));

        return toResponse(repository.save(user));
    }

    public void delete(Long id) {
        User user = getUserById(id);
        ensureOwnerOrAdmin(user);
        user.setDeleted(true);
        user.setDeletedAt(Instant.now());
        user.setDeletedBy(resolveCurrentAuditor(user.getEmail()));
        user.setUpdatedBy(resolveCurrentAuditor(user.getEmail()));
        repository.save(user);
    }

    public UserResponse toResponse(User user) {
        return new UserResponse(
                user.getId(),
                user.getName(),
                user.getEmail(),
                user.getRole(),
                user.getCreatedAt(),
                user.getUpdatedAt(),
                user.getCreatedBy(),
                user.getUpdatedBy(),
                user.isDeleted(),
                user.getDeletedAt(),
                user.getDeletedBy()
        );
    }

    private User getUserById(Long id) {
            return repository.findByIdAndDeletedFalse(id)
                .orElseThrow(() -> new NotFoundException("Usuário não encontrado"));
    }

    private void ensureOwnerOrAdmin(User targetUser) {
        Authentication authentication = SecurityContextHolder.getContext().getAuthentication();

        if (authentication == null || !authentication.isAuthenticated()) {
            throw new ForbiddenException("Autenticação necessária");
        }

        boolean admin = authentication.getAuthorities().stream()
                .map(GrantedAuthority::getAuthority)
                .anyMatch("ROLE_ADMIN"::equals);

        boolean owner = Objects.equals(authentication.getName(), targetUser.getEmail());

        if (!admin && !owner) {
            throw new ForbiddenException("Apenas o dono da conta ou um administrador pode executar esta operação");
        }
    }

    private Specification<User> notDeleted() {
        return (root, query, criteriaBuilder) -> criteriaBuilder.isFalse(root.get("deleted"));
    }

    private Specification<User> containsName(String name) {
        return (root, query, criteriaBuilder) -> {
            if (name == null || name.isBlank()) {
                return criteriaBuilder.conjunction();
            }

            return criteriaBuilder.like(criteriaBuilder.lower(root.get("name")), "%" + name.toLowerCase(Locale.ROOT) + "%");
        };
    }

    private Specification<User> containsEmail(String email) {
        return (root, query, criteriaBuilder) -> {
            if (email == null || email.isBlank()) {
                return criteriaBuilder.conjunction();
            }

            return criteriaBuilder.like(criteriaBuilder.lower(root.get("email")), "%" + email.toLowerCase(Locale.ROOT) + "%");
        };
    }

    private Specification<User> hasRole(String role) {
        return (root, query, criteriaBuilder) -> {
            if (role == null || role.isBlank()) {
                return criteriaBuilder.conjunction();
            }

            return criteriaBuilder.equal(root.get("role"), backend.model.Role.valueOf(role.toUpperCase(Locale.ROOT)));
        };
    }

    private String resolveCurrentAuditor(String fallback) {
        Authentication authentication = SecurityContextHolder.getContext().getAuthentication();

        if (authentication != null && authentication.isAuthenticated()) {
            String name = authentication.getName();
            if (name != null && !name.isBlank()) {
                return name;
            }
        }

        return fallback != null && !fallback.isBlank() ? fallback : "SYSTEM";
    }
}