package app.domain;

public record EnsembleSummaryDocument(
    Integer raceBlindPlans,
    Integer vraConstrainedPlans,
    String populationEqualityThresholdLabel
) {
}
