package backend.controller;

import backend.dto.UserResponse;
import backend.model.Role;
import backend.service.UserService;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageImpl;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;

import java.time.Instant;
import java.util.List;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertSame;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class UserControllerPaginationTest {

    @Mock
    private UserService service;

    @InjectMocks
    private UserController controller;

    @Test
    void listUsersShouldForwardPaginationAndFilters() {
        Page<UserResponse> expectedPage = new PageImpl<>(List.of(
                new UserResponse(1L, "Admin", "admin@email.com", Role.ADMIN,
                        Instant.now(), Instant.now(), "SYSTEM", "SYSTEM", false, null, null)
        ));

        when(service.listAll(PageRequest.of(1, 5), "adm", "email.com", "ADMIN"))
                .thenReturn(expectedPage);

        Page<UserResponse> result = controller.listUsers(1, 5, "adm", "email.com", "ADMIN");

        assertSame(expectedPage, result);

        ArgumentCaptor<Pageable> pageableCaptor = ArgumentCaptor.forClass(Pageable.class);
        verify(service).listAll(pageableCaptor.capture(), org.mockito.ArgumentMatchers.eq("adm"), org.mockito.ArgumentMatchers.eq("email.com"), org.mockito.ArgumentMatchers.eq("ADMIN"));

        Pageable pageable = pageableCaptor.getValue();
        assertEquals(1, pageable.getPageNumber());
        assertEquals(5, pageable.getPageSize());
    }
}
