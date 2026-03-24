package app.domain;

import java.util.Map;

public record StateSummaryDocument(
    String stateCode,
    Integer districts,
    Double votingAgePopulation,
    Map<String, Double> racialEthnicPopulationPct,
    Map<String, Double> racialEthnicPopulationMillions,
    VoterDistributionDocument voterDistribution,
    EnsembleSummaryDocument ensembleSummary,
    String redistrictingControl,
    CongressionalPartySummaryDocument congressionalPartySummary
) {
}
