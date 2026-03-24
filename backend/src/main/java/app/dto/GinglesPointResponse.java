package app.dto;

public record GinglesPointResponse(
    String pid,
    Double x,
    Double demSharePct,
    Double repSharePct
) {
}
