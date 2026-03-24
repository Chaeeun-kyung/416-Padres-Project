package app.advice;

import app.dto.ApiErrorResponse;
import app.exception.BadRequestException;
import app.exception.ResourceNotFoundException;
import java.time.OffsetDateTime;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;
import org.springframework.web.context.request.WebRequest;

@RestControllerAdvice
public class ApiExceptionHandler {

  @ExceptionHandler(ResourceNotFoundException.class)
  public ResponseEntity<ApiErrorResponse> handleNotFound(
      ResourceNotFoundException exception,
      WebRequest request
  ) {
    return buildResponse(HttpStatus.NOT_FOUND, exception.getMessage(), request);
  }

  @ExceptionHandler(BadRequestException.class)
  public ResponseEntity<ApiErrorResponse> handleBadRequest(
      BadRequestException exception,
      WebRequest request
  ) {
    return buildResponse(HttpStatus.BAD_REQUEST, exception.getMessage(), request);
  }

  @ExceptionHandler(IllegalStateException.class)
  public ResponseEntity<ApiErrorResponse> handleIllegalState(
      IllegalStateException exception,
      WebRequest request
  ) {
    return buildResponse(HttpStatus.INTERNAL_SERVER_ERROR, exception.getMessage(), request);
  }

  private ResponseEntity<ApiErrorResponse> buildResponse(
      HttpStatus status,
      String message,
      WebRequest request
  ) {
    String description = request.getDescription(false);
    String path = description.startsWith("uri=") ? description.substring(4) : description;

    ApiErrorResponse body = new ApiErrorResponse(
        OffsetDateTime.now().toString(),
        status.value(),
        status.getReasonPhrase(),
        message,
        path
    );
    return ResponseEntity.status(status).body(body);
  }
}
