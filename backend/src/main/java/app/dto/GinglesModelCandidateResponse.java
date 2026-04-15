package app.dto;

public record GinglesModelCandidateResponse(
    String modelType,
    Double demRmse,
    Double repRmse,
    Double totalRmse
) {
}
