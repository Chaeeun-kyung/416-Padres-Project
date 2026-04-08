package app.domain;

public record GinglesRenderPointDocument(
    String pid,
    Double x,
    Double demSharePct,
    Double repSharePct,
    Double democraticVotes,
    Double republicanVotes,
    Double totalPopulation,
    Double minorityNonWhitePopulation
) {
}
