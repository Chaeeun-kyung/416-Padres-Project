package app.dto;

import java.util.Map;

public record StateSummaryResponse(
    String stateCode,
    Integer districts,
    Double votingAgePopulation,
    Map<String, Double> racialEthnicPopulationPct,
    Map<String, Double> racialEthnicPopulationMillions,
    VoterDistributionResponse voterDistribution,
    EnsembleSummaryResponse ensembleSummary,
    String redistrictingControl,
    CongressionalPartySummaryResponse congressionalPartySummary
) {
}
