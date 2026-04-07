package backend.service;

import backend.dto.UpdateUserRequest;
import backend.exception.ForbiddenException;
import backend.model.Role;
import backend.model.User;
import backend.repository.UserRepository;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.crypto.password.PasswordEncoder;

import java.util.List;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.assertDoesNotThrow;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class UserServiceAuthorizationTest {

    @Mock
    private UserRepository repository;

    @Mock
    private PasswordEncoder encoder;

    @InjectMocks
    private UserService service;

    private User targetUser;

    @BeforeEach
    void setUp() {
        targetUser = User.builder()
                .id(1L)
                .name("Target")
                .email("target@email.com")
                .password("encoded")
                .role(Role.USER)
                .deleted(false)
                .build();

        when(repository.findByIdAndDeletedFalse(1L)).thenReturn(Optional.of(targetUser));
    }

    @AfterEach
    void clearContext() {
        SecurityContextHolder.clearContext();
    }

    @Test
    void updateAllowsOwner() {
        when(repository.save(any(User.class))).thenAnswer(invocation -> invocation.getArgument(0));

        SecurityContextHolder.getContext().setAuthentication(
                new UsernamePasswordAuthenticationToken(
                        "target@email.com",
                        "n/a",
                        List.of(new SimpleGrantedAuthority("ROLE_USER"))
                )
        );

        UpdateUserRequest request = new UpdateUserRequest("Novo Nome", null, null, null);

        assertDoesNotThrow(() -> service.update(1L, request));
    }

    @Test
    void updateAllowsAdmin() {
        when(repository.save(any(User.class))).thenAnswer(invocation -> invocation.getArgument(0));

        SecurityContextHolder.getContext().setAuthentication(
                new UsernamePasswordAuthenticationToken(
                        "admin@email.com",
                        "n/a",
                        List.of(new SimpleGrantedAuthority("ROLE_ADMIN"))
                )
        );

        UpdateUserRequest request = new UpdateUserRequest("Novo Nome", null, null, null);

        assertDoesNotThrow(() -> service.update(1L, request));
    }

    @Test
    void updateBlocksDifferentNonAdminUser() {
        SecurityContextHolder.getContext().setAuthentication(
                new UsernamePasswordAuthenticationToken(
                        "other@email.com",
                        "n/a",
                        List.of(new SimpleGrantedAuthority("ROLE_USER"))
                )
        );

        UpdateUserRequest request = new UpdateUserRequest("Novo Nome", null, null, null);

        assertThrows(ForbiddenException.class, () -> service.update(1L, request));
    }

    @Test
    void deletePerformsSoftDeleteAndAudit() {
        when(repository.save(any(User.class))).thenAnswer(invocation -> invocation.getArgument(0));

        SecurityContextHolder.getContext().setAuthentication(
                new UsernamePasswordAuthenticationToken(
                        "target@email.com",
                        "n/a",
                        List.of(new SimpleGrantedAuthority("ROLE_USER"))
                )
        );

        service.delete(1L);

        ArgumentCaptor<User> captor = ArgumentCaptor.forClass(User.class);
        verify(repository).save(captor.capture());
        User saved = captor.getValue();

        assertEquals(true, saved.isDeleted());
        assertEquals("target@email.com", saved.getDeletedBy());
        assertNotNull(saved.getDeletedAt());
    }
}
