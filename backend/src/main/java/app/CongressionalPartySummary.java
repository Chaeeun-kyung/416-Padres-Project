package app;

// Nested object inside StateSummaryResponse.
public record CongressionalPartySummary(
    Integer democrats,
    Integer republicans
) {
}
