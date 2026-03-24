package app.dto;

import java.util.List;

public record EnsembleSplitsResponse(
    String stateCode,
    Integer districtCount,
    List<EnsembleSplitBucketResponse> raceBlind,
    List<EnsembleSplitBucketResponse> vraConstrained
) {
}
