package app.dto;

import java.util.List;

public record GinglesResponse(
    String stateCode,
    String groupKey,
    String groupLabel,
    List<AnalysisGroupOptionResponse> availableGroups,
    List<GinglesPointResponse> points,
    List<GinglesTrendPointResponse> trendRows,
    Integer totalPointCount,
    Integer renderPointCount,
    String modelType,
    List<Double> demCoefficients,
    List<Double> repCoefficients,
    List<GinglesModelCandidateResponse> modelCandidates
) {
}
