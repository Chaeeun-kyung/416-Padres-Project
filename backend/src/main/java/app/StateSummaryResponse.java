package app;

import java.util.Map;

// This record defines the JSON shape returned to the frontend.
public record StateSummaryResponse(
    Integer districts,
    Map<String, Double> racialEthnicPopulationMillions,
    String redistrictingControl,
    CongressionalPartySummary congressionalPartySummary
) {
}
