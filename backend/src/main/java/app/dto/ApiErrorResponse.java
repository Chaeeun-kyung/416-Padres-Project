package app.dto;

public record ApiErrorResponse(
    String timestamp,
    Integer status,
    String error,
    String message,
    String path
) {
}
