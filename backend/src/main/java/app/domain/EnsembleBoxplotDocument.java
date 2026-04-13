package app.domain;

import java.util.List;
import java.util.Map;

public record EnsembleBoxplotDocument(
    Map<String, List<Double>> distributions,
    Map<String, Double> enacted
) {
}
