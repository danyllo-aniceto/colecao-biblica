package backend.dto;

import backend.model.Role;

public record UpdateUserRequest(String name, String email, String password, Role role) {
}
