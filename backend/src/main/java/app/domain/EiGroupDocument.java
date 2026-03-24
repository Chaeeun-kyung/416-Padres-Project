package app.domain;

import java.util.List;

public record EiGroupDocument(
    String label,
    List<EiDensityPointDocument> demRows,
    List<EiDensityPointDocument> repRows
) {
}
