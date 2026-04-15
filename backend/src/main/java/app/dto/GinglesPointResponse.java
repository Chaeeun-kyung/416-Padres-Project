package app.dto;

import java.util.Map;

public record GinglesPointResponse(
    String pid,
    Double x,
    Double demSharePct,
    Double repSharePct,
    String winningParty,
    Double democraticVotes,
    Double republicanVotes,
    Double totalPopulation,
    Map<String, Double> groupPercentages,
    Map<String, Double> groupPopulations
) {
}
