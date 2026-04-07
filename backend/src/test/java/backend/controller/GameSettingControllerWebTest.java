package backend.controller;

import backend.dto.GameSettingsResponse;
import backend.dto.UpdateGameSettingsRequest;
import backend.service.GameSettingService;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import jakarta.validation.ConstraintViolation;
import jakarta.validation.Validation;
import jakarta.validation.Validator;

import java.util.Set;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class GameSettingControllerWebTest {

  private final Validator validator = Validation.buildDefaultValidatorFactory().getValidator();

  @Mock
    private GameSettingService gameSettingService;

  @InjectMocks
  private GameSettingController controller;

    @Test
    void shouldReturnSettings() throws Exception {
        when(gameSettingService.getSettings()).thenReturn(new GameSettingsResponse(100, 3, 4, 35));

    GameSettingsResponse response = controller.getSettings();

    assertEquals(100, response.maxQuestionsPerMatch());
    assertEquals(3, response.startingLives());
    }

    @Test
    void shouldValidateSettingsUpdatePayload() throws Exception {
    UpdateGameSettingsRequest request = new UpdateGameSettingsRequest(0, null, null, null);

    Set<ConstraintViolation<UpdateGameSettingsRequest>> violations = validator.validate(request);
    assertFalse(violations.isEmpty());
    }
}
