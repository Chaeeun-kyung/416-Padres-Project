package app.service;

import app.domain.EnsembleBoxplotVariantDocument;
import app.domain.EnsembleSplitBucketDocument;
import app.domain.EnsembleSplitsDocument;
import app.domain.StateSummaryDocument;
import app.dto.EnsembleBoxplotResponse;
import app.dto.EnsembleSplitBucketResponse;
import app.dto.EnsembleSplitsResponse;
import app.dto.SelectionOptionResponse;
import app.exception.BadRequestException;
import app.exception.ResourceNotFoundException;
import app.repository.EnsembleBoxplotRepository;
import app.repository.EnsembleSplitRepository;
import app.repository.StateSummaryRepository;
import java.util.List;
import java.util.Map;
import org.springframework.cache.annotation.Cacheable;
import org.springframework.stereotype.Service;

@Service
public class EnsembleService {
  private static final String DEFAULT_GROUP = "latino_pct";
  private static final String DEFAULT_ENSEMBLE = "raceBlind";
  private static final Map<String, String> GROUP_LABELS = Map.of(
      "white_pct", "White",
      "latino_pct", "Latino"
  );
  private static final Map<String, String> ENSEMBLE_LABELS = Map.of(
      "raceBlind", "Race-blind Ensemble",
      "vraConstrained", "VRA-constrained Ensemble"
  );
  private static final List<String> AVAILABLE_GROUP_KEYS = List.of("white_pct", "latino_pct");
  private static final List<String> AVAILABLE_ENSEMBLES = List.of("raceBlind", "vraConstrained");

  private final EnsembleSplitRepository ensembleSplitRepository;
  private final EnsembleBoxplotRepository ensembleBoxplotRepository;
  private final StateSummaryRepository stateSummaryRepository;

  public EnsembleService(
      EnsembleSplitRepository ensembleSplitRepository,
      EnsembleBoxplotRepository ensembleBoxplotRepository,
      StateSummaryRepository stateSummaryRepository
  ) {
    this.ensembleSplitRepository = ensembleSplitRepository;
    this.ensembleBoxplotRepository = ensembleBoxplotRepository;
    this.stateSummaryRepository = stateSummaryRepository;
  }

  @Cacheable(
      cacheNames = "ensembleSplits",
      key = "#rawStateCode == null ? '' : #rawStateCode.trim().toUpperCase()",
      sync = true
  )
  public EnsembleSplitsResponse getSplits(String rawStateCode) {
    String stateCode = normalizeStateCode(rawStateCode);
    EnsembleSplitsDocument document = ensembleSplitRepository.findByStateCode(stateCode);
    if (document == null) {
      throw new ResourceNotFoundException("Ensemble splits not found for state " + stateCode);
    }

    StateSummaryDocument summary = stateSummaryRepository.findByStateCode(stateCode);
    Integer districtCount = summary == null ? null : summary.districts();

    return new EnsembleSplitsResponse(
        stateCode,
        districtCount,
        mapBuckets(document.raceBlind()),
        mapBuckets(document.vraConstrained())
    );
  }

  @Cacheable(
      cacheNames = "ensembleBoxplot",
      key = "(#rawStateCode == null ? '' : #rawStateCode.trim().toUpperCase()) + '::' + (#rawGroup == null ? '' : #rawGroup.trim().toLowerCase()) + '::' + (#rawEnsemble == null ? '' : #rawEnsemble.trim().toLowerCase())",
      sync = true
  )
  public EnsembleBoxplotResponse getBoxplot(String rawStateCode, String rawGroup, String rawEnsemble) {
    String stateCode = normalizeStateCode(rawStateCode);
    String groupKey = normalizeKey(rawGroup, AVAILABLE_GROUP_KEYS, DEFAULT_GROUP, "ensemble boxplot group");
    String ensembleKey = normalizeKey(rawEnsemble, AVAILABLE_ENSEMBLES, DEFAULT_ENSEMBLE, "ensemble type");

    EnsembleBoxplotVariantDocument document = ensembleBoxplotRepository.findByStateCodeAndGroupKeyAndEnsembleKey(
        stateCode,
        groupKey,
        ensembleKey
    );
    if (document == null) {
      throw new ResourceNotFoundException("Ensemble boxplot data not found for state " + stateCode);
    }

    return new EnsembleBoxplotResponse(
        document.stateCode(),
        document.groupKey(),
        GROUP_LABELS.getOrDefault(document.groupKey(), document.groupKey()),
        document.ensembleKey(),
        ENSEMBLE_LABELS.getOrDefault(document.ensembleKey(), document.ensembleKey()),
        selectionOptions(AVAILABLE_GROUP_KEYS, GROUP_LABELS),
        selectionOptions(AVAILABLE_ENSEMBLES, ENSEMBLE_LABELS),
        document.districtOrder(),
        document.distributions(),
        document.enacted()
    );
  }

  private List<EnsembleSplitBucketResponse> mapBuckets(List<EnsembleSplitBucketDocument> buckets) {
    return (buckets == null ? List.<EnsembleSplitBucketDocument>of() : buckets)
        .stream()
        .map(bucket -> new EnsembleSplitBucketResponse(bucket.repWins(), bucket.freq()))
        .toList();
  }

  private String normalizeStateCode(String stateCode) {
    if (stateCode == null || stateCode.isBlank()) {
      throw new BadRequestException("State code is required");
    }
    return stateCode.trim().toUpperCase();
  }

  private String normalizeKey(String rawValue, List<String> validKeys, String defaultKey, String label) {
    if (validKeys == null || validKeys.isEmpty()) {
      throw new BadRequestException("No valid options available for " + label);
    }
    if (rawValue == null || rawValue.isBlank()) {
      return validKeys.contains(defaultKey) ? defaultKey : validKeys.get(0);
    }

    String lowered = rawValue.trim().toLowerCase();
    for (String validKey : validKeys) {
      if (validKey.equalsIgnoreCase(lowered)) {
        return validKey;
      }
    }

    throw new BadRequestException("Unsupported " + label + ": " + rawValue);
  }

  private List<SelectionOptionResponse> selectionOptions(List<String> orderedKeys, Map<String, String> labels) {
    return orderedKeys.stream()
        .map(key -> new SelectionOptionResponse(key, labels.getOrDefault(key, key)))
        .toList();
  }
}
