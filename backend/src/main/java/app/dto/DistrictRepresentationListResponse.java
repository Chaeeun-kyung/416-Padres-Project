package app.dto;

import java.util.List;

public record DistrictRepresentationListResponse(
    String stateCode,
    List<DistrictRepresentationRowResponse> rows
) {
}
