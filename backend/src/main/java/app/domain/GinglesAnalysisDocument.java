package app.domain;

import java.util.Map;

public record GinglesAnalysisDocument(
    String generated_at_utc,
    Double feasibleGroupThresholdCvap,
    Map<String, String> groupLabels,
    Map<String, GinglesStateDocument> states
) {
}
