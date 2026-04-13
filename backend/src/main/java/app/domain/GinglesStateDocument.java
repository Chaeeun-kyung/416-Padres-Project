package app.domain;

import java.util.Map;

public record GinglesStateDocument(
    Map<String, GinglesGroupDocument> groups
) {
}
