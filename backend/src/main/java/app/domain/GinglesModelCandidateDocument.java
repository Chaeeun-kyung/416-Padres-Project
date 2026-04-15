package app.domain;

public record GinglesModelCandidateDocument(
    String modelType,
    Double demRmse,
    Double repRmse,
    Double totalRmse
) {
}
