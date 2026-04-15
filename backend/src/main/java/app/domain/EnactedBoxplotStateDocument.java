package app.domain;

import java.util.Map;

public record EnactedBoxplotStateDocument(
    Map<String, EnactedBoxplotGroupDocument> groups
) {
}
