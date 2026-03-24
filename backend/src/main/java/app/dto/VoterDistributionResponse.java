package app.dto;

public record VoterDistributionResponse(
    Integer demVotes,
    Integer repVotes,
    Integer totalVotes,
    Double demPct,
    Double repPct
) {
}
