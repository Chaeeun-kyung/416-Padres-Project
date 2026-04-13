package app.dto;

public record GinglesPointResponse(
    String pid,
    Double x,
    Double demSharePct,
    Double repSharePct,
    Double democraticVotes,
    Double republicanVotes,
    Double totalPopulation,
    Double whitePopulation,
    Double latinoPopulation,
    Double minorityNonWhitePopulation
) {
}
