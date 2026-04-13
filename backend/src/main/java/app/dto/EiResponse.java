package app.dto;

import java.util.List;

public record EiResponse(
    String stateCode,
    String groupKey,
    String groupLabel,
    String nonGroupLabel,
    List<AnalysisGroupOptionResponse> availableGroups,
    List<EiDensityPointResponse> demRows,
    List<EiDensityPointResponse> repRows
) {
}
