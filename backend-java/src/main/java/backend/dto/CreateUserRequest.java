package backend.dto;

import backend.model.Role;

public record CreateUserRequest(String name, String email, String password, Role role) {
}
