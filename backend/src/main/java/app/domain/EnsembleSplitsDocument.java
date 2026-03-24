package app.domain;

import java.util.List;

public record EnsembleSplitsDocument(
    List<EnsembleSplitBucketDocument> raceBlind,
    List<EnsembleSplitBucketDocument> vraConstrained
) {
}
