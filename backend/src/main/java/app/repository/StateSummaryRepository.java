package app.repository;

import app.domain.StateSummaryDocument;
import app.repository.support.ResourceJsonLoader;
import com.fasterxml.jackson.core.type.TypeReference;
import java.util.Map;
import org.springframework.stereotype.Repository;

@Repository
public class StateSummaryRepository {
  private static final String RESOURCE = "state-summary.json";

  private final Map<String, StateSummaryDocument> summariesByStateCode;

  public StateSummaryRepository(ResourceJsonLoader jsonLoader) {
    TypeReference<Map<String, StateSummaryDocument>> type = new TypeReference<>() {};
    Map<String, StateSummaryDocument> raw = jsonLoader.readResource(RESOURCE, type);
    this.summariesByStateCode = jsonLoader.normalizeKeys(raw);
  }

  public StateSummaryDocument findByStateCode(String stateCode) {
    return summariesByStateCode.get(stateCode);
  }
}
