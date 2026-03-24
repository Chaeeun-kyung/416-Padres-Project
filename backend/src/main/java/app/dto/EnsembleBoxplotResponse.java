package app.dto;

import java.util.List;
import java.util.Map;

public record EnsembleBoxplotResponse(
    String stateCode,
    String groupKey,
    String groupLabel,
    String ensembleKey,
    String ensembleLabel,
    List<SelectionOptionResponse> availableGroups,
    List<SelectionOptionResponse> availableEnsembles,
    List<String> districtOrder,
    Map<String, List<Double>> distributions,
    Map<String, Double> enacted
) {
}
