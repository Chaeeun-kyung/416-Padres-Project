package app.domain;

import java.util.List;

public record GinglesGroupDocument(
    String label,
    String modelType,
    Integer totalPointCount,
    Integer renderPointCount,
    List<Double> demCoefficients,
    List<Double> repCoefficients,
    List<GinglesRenderPointDocument> points,
    List<GinglesTrendPointDocument> trendRows
) {
}
