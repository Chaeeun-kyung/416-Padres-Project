package app.service;

import app.domain.EiDensityPointDocument;
import app.domain.EiGroupDocument;
import app.domain.GinglesGroupDocument;
import app.domain.GinglesRenderPointDocument;
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
import java.util.List;
import java.util.Map;
import org.springframework.cache.annotation.Cacheable;
import org.springframework.stereotype.Service;

@Service
public class AnalysisService {
  private static final String DEFAULT_GROUP = "latino_pct";
  private static final Map<String, String> GROUP_LABELS = Map.of(
      "white_pct", "White",
      "latino_pct", "Latino"
  );
  private static final List<String> AVAILABLE_GROUP_KEYS = List.of("white_pct", "latino_pct");

  private final GinglesAnalysisRepository ginglesAnalysisRepository;
  private final EiAnalysisRepository eiAnalysisRepository;

  public AnalysisService(
      GinglesAnalysisRepository ginglesAnalysisRepository,
      EiAnalysisRepository eiAnalysisRepository
  ) {
    this.ginglesAnalysisRepository = ginglesAnalysisRepository;
    this.eiAnalysisRepository = eiAnalysisRepository;
  }

  @Cacheable(
      cacheNames = "gingles",
      key = "(#rawStateCode == null ? '' : #rawStateCode.trim().toUpperCase()) + '::' + (#rawGroup == null ? '' : #rawGroup.trim().toLowerCase())",
      sync = true
  )
  public GinglesResponse getGingles(String rawStateCode, String rawGroup) {
    String stateCode = normalizeStateCode(rawStateCode);
    String groupKey = normalizeGroupKey(rawGroup);
    GinglesGroupDocument groupDocument = ginglesAnalysisRepository.findByStateCodeAndGroupKey(stateCode, groupKey);
    if (groupDocument == null) {
      throw new ResourceNotFoundException("Gingles data not found for group " + groupKey + " in state " + stateCode);
    }

    return new GinglesResponse(
        stateCode,
        groupKey,
        resolveGroupLabel(groupKey, groupDocument.label()),
        availableGroups(),
        mapGinglesPoints(groupDocument.points()),
        mapGinglesTrendRows(groupDocument.trendRows()),
        groupDocument.totalPointCount(),
        groupDocument.renderPointCount(),
        groupDocument.demCoefficients() == null ? List.of() : List.copyOf(groupDocument.demCoefficients()),
        groupDocument.repCoefficients() == null ? List.of() : List.copyOf(groupDocument.repCoefficients())
    );
  }

  @Cacheable(
      cacheNames = "ei",
      key = "(#rawStateCode == null ? '' : #rawStateCode.trim().toUpperCase()) + '::' + (#rawGroup == null ? '' : #rawGroup.trim().toLowerCase())",
      sync = true
  )
  public EiResponse getEi(String rawStateCode, String rawGroup) {
    String stateCode = normalizeStateCode(rawStateCode);
    String groupKey = normalizeGroupKey(rawGroup);
    EiGroupDocument groupDocument = eiAnalysisRepository.findByStateCodeAndGroupKey(stateCode, groupKey);
    if (groupDocument == null) {
      throw new ResourceNotFoundException("EI data not found for group " + groupKey + " in state " + stateCode);
    }

    String groupLabel = resolveGroupLabel(groupKey, groupDocument.label());
    String nonGroupLabel = groupLabel.isBlank()
        ? "Non-selected group"
        : "Non-" + groupLabel;

    return new EiResponse(
        stateCode,
        groupKey,
        groupLabel,
        nonGroupLabel,
        availableGroups(),
        mapDensityRows(groupDocument.demRows()),
        mapDensityRows(groupDocument.repRows())
    );
  }

  private List<AnalysisGroupOptionResponse> availableGroups() {
    return AVAILABLE_GROUP_KEYS.stream()
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

  private String normalizeGroupKey(String rawGroup) {
    if (rawGroup == null || rawGroup.isBlank()) {
      return DEFAULT_GROUP;
    }

    String lowered = rawGroup.trim().toLowerCase();
    for (String validGroup : AVAILABLE_GROUP_KEYS) {
      if (validGroup.equalsIgnoreCase(lowered)) {
        return validGroup;
      }
    }

    throw new BadRequestException("Unsupported analysis group: " + rawGroup);
  }
}
