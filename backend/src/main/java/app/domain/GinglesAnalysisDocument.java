package app.domain;

import java.util.Map;

public record GinglesAnalysisDocument(
    String generated_at_utc,
    Map<String, GinglesStateDocument> states
) {
}
