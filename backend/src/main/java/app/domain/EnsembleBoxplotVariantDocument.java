package app.domain;

import java.util.List;
import java.util.Map;

public record EnsembleBoxplotVariantDocument(
    String stateCode,
    String groupKey,
    String ensembleKey,
    List<String> districtOrder,
    Map<String, List<Double>> distributions,
    Map<String, Double> enacted
) {
}
