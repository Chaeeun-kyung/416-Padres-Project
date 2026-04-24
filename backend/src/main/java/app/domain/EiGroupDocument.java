package app.domain;

import java.util.List;

public record EiGroupDocument(
    String label,
    String demCandidateLabel,
    String repCandidateLabel,
    List<EiDensityPointDocument> demRows,
    List<EiDensityPointDocument> repRows
) {
}
