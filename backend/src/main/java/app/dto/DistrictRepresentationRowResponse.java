package app.dto;

public record DistrictRepresentationRowResponse(
    String districtId,
    String incumbent,
    String party,
    String repRaceEthnicity,
    Double voteMarginPct
) {
}
