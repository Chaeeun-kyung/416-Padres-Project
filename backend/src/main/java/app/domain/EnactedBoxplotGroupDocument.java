package app.domain;

import java.util.List;
import java.util.Map;

public record EnactedBoxplotGroupDocument(
    String label,
    List<String> districtOrder,
    Map<String, Double> enacted
) {
}
