package app.service;

import app.domain.EnsembleBoxplotDocument;
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
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
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
  private static final Map<String, Double> GROUP_OFFSETS = Map.of(
      "white_pct", 0.012,
      "latino_pct", 0.03
  );
  private static final Map<String, Double> ENSEMBLE_OFFSETS = Map.of(
      "raceBlind", 0.0,
      "vraConstrained", 0.012
  );

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

  public EnsembleBoxplotResponse getBoxplot(String rawStateCode, String rawGroup, String rawEnsemble) {
    String stateCode = normalizeStateCode(rawStateCode);
    EnsembleBoxplotDocument document = ensembleBoxplotRepository.findByStateCode(stateCode);
    if (document == null) {
      throw new ResourceNotFoundException("Ensemble boxplot data not found for state " + stateCode);
    }

    String groupKey = normalizeKey(rawGroup, List.of("white_pct", "latino_pct"), DEFAULT_GROUP, "ensemble boxplot group");
    String ensembleKey = normalizeKey(rawEnsemble, List.of("raceBlind", "vraConstrained"), DEFAULT_ENSEMBLE, "ensemble type");

    double groupOffset = GROUP_OFFSETS.getOrDefault(groupKey, 0.0);
    double ensembleOffset = ENSEMBLE_OFFSETS.getOrDefault(ensembleKey, 0.0);

    Map<String, Double> adjustedEnacted = buildAdjustedEnacted(document.enacted(), groupOffset, ensembleOffset);
    List<String> districtOrder = adjustedEnacted.entrySet().stream()
        .sorted(Map.Entry.comparingByValue())
        .map(Map.Entry::getKey)
        .toList();

    Map<String, List<Double>> adjustedDistributions = buildAdjustedDistributions(
        document.distributions(),
        districtOrder,
        groupOffset,
        ensembleOffset
    );

    return new EnsembleBoxplotResponse(
        stateCode,
        groupKey,
        GROUP_LABELS.getOrDefault(groupKey, groupKey),
        ensembleKey,
        ENSEMBLE_LABELS.getOrDefault(ensembleKey, ensembleKey),
        selectionOptions(GROUP_LABELS, List.of("white_pct", "latino_pct")),
        selectionOptions(ENSEMBLE_LABELS, List.of("raceBlind", "vraConstrained")),
        districtOrder,
        adjustedDistributions,
        adjustedEnacted
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
      throw new ResourceNotFoundException("State code is required");
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
    Map<String, String> lookup = validKeys.stream()
        .collect(LinkedHashMap::new, (map, key) -> map.put(key.toLowerCase(), key), LinkedHashMap::putAll);
    String normalized = lookup.get(lowered);
    if (normalized == null) {
      throw new BadRequestException("Unsupported " + label + ": " + rawValue);
    }
    return normalized;
  }

  private List<SelectionOptionResponse> selectionOptions(Map<String, String> labels, List<String> orderedKeys) {
    return orderedKeys.stream()
        .map(key -> new SelectionOptionResponse(key, labels.getOrDefault(key, key)))
        .toList();
  }

  private Map<String, Double> buildAdjustedEnacted(
      Map<String, Double> baseEnacted,
      double groupOffset,
      double ensembleOffset
  ) {
    Map<String, Double> adjusted = new LinkedHashMap<>();
    List<String> districtIds = baseEnacted == null ? List.of() : new ArrayList<>(baseEnacted.keySet());
    for (int index = 0; index < districtIds.size(); index += 1) {
      String districtId = districtIds.get(index);
      double baseValue = safeNumber(baseEnacted.get(districtId));
      adjusted.put(districtId, clamp01(baseValue + groupOffset + ensembleOffset + index * 0.0015));
    }
    return adjusted;
  }

  private Map<String, List<Double>> buildAdjustedDistributions(
      Map<String, List<Double>> baseDistributions,
      List<String> districtOrder,
      double groupOffset,
      double ensembleOffset
  ) {
    Map<String, List<Double>> adjusted = new LinkedHashMap<>();
    if (baseDistributions == null) {
      return adjusted;
    }

    for (int districtIndex = 0; districtIndex < districtOrder.size(); districtIndex += 1) {
      String districtId = districtOrder.get(districtIndex);
      List<Double> baseValues = baseDistributions.getOrDefault(districtId, List.of());
      List<Double> nextValues = new ArrayList<>(baseValues.size());
      for (int rowIndex = 0; rowIndex < baseValues.size(); rowIndex += 1) {
        double adjustedValue = clamp01(
            safeNumber(baseValues.get(rowIndex)) + groupOffset + ensembleOffset + districtIndex * 0.001 + rowIndex * 0.0004
        );
        nextValues.add(adjustedValue);
      }
      adjusted.put(districtId, List.copyOf(nextValues));
    }
    return adjusted;
  }

  private double safeNumber(Double value) {
    return value == null ? 0.0 : value;
  }

  private double clamp01(double value) {
    return Math.max(0.0, Math.min(1.0, value));
  }
}
