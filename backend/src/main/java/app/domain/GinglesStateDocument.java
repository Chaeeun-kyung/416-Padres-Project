package app.domain;

import java.util.List;
import java.util.Map;

public record GinglesStateDocument(
    List<String> feasibleGroups,
    Map<String, Double> statewideGroupCvap,
    Map<String, GinglesGroupDocument> groups
) {
}
