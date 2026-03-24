package app.domain;

public record VoterDistributionDocument(
    Integer demVotes,
    Integer repVotes,
    Integer totalVotes,
    Double demPct,
    Double repPct
) {
}
