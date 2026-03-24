package app.dto;

public record EnsembleSummaryResponse(
    Integer raceBlindPlans,
    Integer vraConstrainedPlans,
    String populationEqualityThresholdLabel
) {
}
