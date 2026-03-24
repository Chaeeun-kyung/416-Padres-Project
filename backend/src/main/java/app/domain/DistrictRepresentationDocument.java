package app.domain;

public record DistrictRepresentationDocument(
    String districtId,
    String incumbent,
    String party,
    String repRaceEthnicity,
    Double voteMarginPct
) {
}
