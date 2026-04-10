package app.service;

import app.domain.EiDensityPointDocument;
import app.domain.EiGroupDocument;
import app.domain.EiStateDocument;
import app.domain.GinglesGroupDocument;
import app.domain.GinglesRenderPointDocument;
import app.domain.GinglesStateDocument;
import app.domain.GinglesTrendPointDocument;
import app.dto.AnalysisGroupOptionResponse;
import app.dto.EiDensityPointResponse;
import app.dto.EiResponse;
import app.dto.GinglesPointResponse;
import app.dto.GinglesResponse;
import app.dto.GinglesTrendPointResponse;
import app.exception.BadRequestException;
import app.exception.ResourceNotFoundException;
import app.repository.EiAnalysisRepository;
import app.repository.GinglesAnalysisRepository;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;
import org.springframework.stereotype.Service;

@Service
public class AnalysisService {
  private static final String DEFAULT_GROUP = "latino_pct";
  private static final Map<String, String> GROUP_LABELS = Map.of(
      "white_pct", "White",
      "latino_pct", "Latino",
      "black_pct", "Black",
      "asian_pct", "Asian"
  );

  private final GinglesAnalysisRepository ginglesAnalysisRepository;
  private final EiAnalysisRepository eiAnalysisRepository;

  public AnalysisService(
      GinglesAnalysisRepository ginglesAnalysisRepository,
      EiAnalysisRepository eiAnalysisRepository
  ) {
    this.ginglesAnalysisRepository = ginglesAnalysisRepository;
    this.eiAnalysisRepository = eiAnalysisRepository;
  }

  public GinglesResponse getGingles(String rawStateCode, String rawGroup) {
    String stateCode = normalizeStateCode(rawStateCode);
    GinglesStateDocument stateDocument = ginglesAnalysisRepository.findByStateCode(stateCode);
    if (stateDocument == null || stateDocument.groups() == null || stateDocument.groups().isEmpty()) {
      throw new ResourceNotFoundException("Gingles data not found for state " + stateCode);
    }

    List<String> validGroups = List.copyOf(stateDocument.groups().keySet());
    String groupKey = normalizeGroupKey(rawGroup, validGroups);
    GinglesGroupDocument groupDocument = stateDocument.groups().get(groupKey);
    if (groupDocument == null) {
      throw new ResourceNotFoundException("Gingles data not found for group " + groupKey + " in state " + stateCode);
    }

    return new GinglesResponse(
        stateCode,
        groupKey,
        resolveGroupLabel(groupKey, groupDocument.label()),
        availableGroups(validGroups),
        mapGinglesPoints(groupDocument.points()),
        mapGinglesTrendRows(groupDocument.trendRows()),
        groupDocument.totalPointCount(),
        groupDocument.renderPointCount(),
        groupDocument.demCoefficients() == null ? List.of() : List.copyOf(groupDocument.demCoefficients()),
        groupDocument.repCoefficients() == null ? List.of() : List.copyOf(groupDocument.repCoefficients())
    );
  }

  public EiResponse getEi(String rawStateCode, String rawGroup) {
    String stateCode = normalizeStateCode(rawStateCode);
    EiStateDocument stateDocument = eiAnalysisRepository.findByStateCode(stateCode);
    if (stateDocument == null || stateDocument.groups() == null || stateDocument.groups().isEmpty()) {
      throw new ResourceNotFoundException("EI data not found for state " + stateCode);
    }

    List<String> validGroups = new ArrayList<>(stateDocument.groups().keySet());
    String groupKey = normalizeGroupKey(rawGroup, validGroups);
    EiGroupDocument groupDocument = stateDocument.groups().get(groupKey);
    if (groupDocument == null) {
      throw new ResourceNotFoundException("EI data not found for group " + groupKey + " in state " + stateCode);
    }

    String groupLabel = groupDocument.label();
    String nonGroupLabel = groupLabel == null || groupLabel.isBlank()
        ? "Non-selected group"
        : "Non-" + groupLabel;

    return new EiResponse(
        stateCode,
        groupKey,
        groupLabel,
        nonGroupLabel,
        availableGroups(validGroups),
        mapDensityRows(groupDocument.demRows()),
        mapDensityRows(groupDocument.repRows())
    );
  }

  private List<AnalysisGroupOptionResponse> availableGroups(List<String> keys) {
    return keys.stream()
        .map(key -> new AnalysisGroupOptionResponse(key, GROUP_LABELS.getOrDefault(key, key)))
        .toList();
  }

  private String resolveGroupLabel(String groupKey, String explicitLabel) {
    if (explicitLabel != null && !explicitLabel.isBlank()) {
      return explicitLabel;
    }
    return GROUP_LABELS.getOrDefault(groupKey, groupKey);
  }

  private List<EiDensityPointResponse> mapDensityRows(List<EiDensityPointDocument> rows) {
    if (rows == null) {
      return List.of();
    }
    return rows.stream()
        .map(row -> new EiDensityPointResponse(row.x(), row.group(), row.nonGroup()))
        .toList();
  }

  private List<GinglesPointResponse> mapGinglesPoints(List<GinglesRenderPointDocument> points) {
    if (points == null) {
      return List.of();
    }
    return points.stream()
        .map(point -> new GinglesPointResponse(
            point.pid(),
            point.x(),
            point.demSharePct(),
            point.repSharePct(),
            point.democraticVotes(),
            point.republicanVotes(),
            point.totalPopulation(),
            point.whitePopulation(),
            point.latinoPopulation(),
            point.minorityNonWhitePopulation()
        ))
        .toList();
  }

  private List<GinglesTrendPointResponse> mapGinglesTrendRows(List<GinglesTrendPointDocument> rows) {
    if (rows == null) {
      return List.of();
    }
    return rows.stream()
        .map(row -> new GinglesTrendPointResponse(row.x(), row.demTrendPct(), row.repTrendPct()))
        .toList();
  }

  private String normalizeStateCode(String stateCode) {
    if (stateCode == null || stateCode.isBlank()) {
      throw new BadRequestException("State code is required");
    }
    return stateCode.trim().toUpperCase();
  }

  private String normalizeGroupKey(String rawGroup, List<String> validGroups) {
    if (validGroups == null || validGroups.isEmpty()) {
      throw new BadRequestException("No valid analysis groups available");
    }

    if (rawGroup == null || rawGroup.isBlank()) {
      return validGroups.contains(DEFAULT_GROUP) ? DEFAULT_GROUP : validGroups.get(0);
    }

    String groupKey = rawGroup.trim().toLowerCase();
    Map<String, String> lookup = validGroups.stream()
        .collect(Collectors.toMap(String::toLowerCase, key -> key, (left, right) -> left, LinkedHashMap::new));
    String normalized = lookup.get(groupKey);
    if (normalized == null) {
      throw new BadRequestException("Unsupported analysis group: " + rawGroup);
    }
    return normalized;
  }
}
