package app.domain;

import java.util.Map;

public record EiStateDocument(
    Map<String, EiGroupDocument> groups
) {
}
