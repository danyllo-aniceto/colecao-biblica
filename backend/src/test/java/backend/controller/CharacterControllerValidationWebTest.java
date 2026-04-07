package backend.controller;

import backend.dto.CreateCharacterRequest;
import backend.model.StickerRarity;
import org.junit.jupiter.api.Test;
import jakarta.validation.ConstraintViolation;
import jakarta.validation.Validation;
import jakarta.validation.Validator;

import java.util.Set;

import static org.junit.jupiter.api.Assertions.assertFalse;

class CharacterControllerValidationWebTest {

  private final Validator validator = Validation.buildDefaultValidatorFactory().getValidator();

  @Test
  void createPayloadShouldFailValidationWhenNameIsBlank() {
    CreateCharacterRequest request = new CreateCharacterRequest(
        "",
        null,
        StickerRarity.RARE,
        "resumo",
        "descricao",
        null,
        null,
        null,
        null,
        null,
        null,
        null,
        null,
        null
    );

      Set<ConstraintViolation<CreateCharacterRequest>> violations = validator.validate(request);
      assertFalse(violations.isEmpty());
  }
}
