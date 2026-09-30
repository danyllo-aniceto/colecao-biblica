package backend.controller;

import backend.dto.CreateUserRequest;
import backend.dto.UpdateUserRequest;
import backend.dto.UserResponse;
import backend.service.UserService;
import backend.service.CurrentUserService;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/users")
public class UserController {

    private final UserService service;
    private final CurrentUserService currentUserService;

    public UserController(UserService service, CurrentUserService currentUserService) {
        this.service = service;
        this.currentUserService = currentUserService;
    }

    @PostMapping
    public UserResponse createUser(@RequestBody CreateUserRequest request) {
        return service.create(request);
    }

    @GetMapping
    public Page<UserResponse> listUsers(@RequestParam(defaultValue = "0") int page,
                                        @RequestParam(defaultValue = "10") int size,
                                        @RequestParam(required = false) String name,
                                        @RequestParam(required = false) String email,
                                        @RequestParam(required = false) String role) {
        Pageable pageable = PageRequest.of(page, size);
        return service.listAll(pageable, name, email, role);
    }

    @GetMapping("/{id}")
    public UserResponse getUserById(@PathVariable Long id) {
        return service.findById(id);
    }

    @GetMapping("/me")
    public UserResponse getCurrentUser() {
        return service.toResponse(currentUserService.getCurrentUser());
    }

    @PutMapping("/{id}")
    public UserResponse updateUser(@PathVariable Long id, @RequestBody UpdateUserRequest request) {
        return service.update(id, request);
    }

    @DeleteMapping("/{id}")
    public void deleteUser(@PathVariable Long id) {
        service.delete(id);
    }
}