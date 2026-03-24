package app.repository;

import app.domain.EiStateDocument;
import app.repository.support.ResourceJsonLoader;
import com.fasterxml.jackson.core.type.TypeReference;
import java.util.Map;
import org.springframework.stereotype.Repository;

@Repository
public class EiAnalysisRepository {
  private static final String RESOURCE = "ei-analysis.json";

  private final Map<String, EiStateDocument> statesByCode;

  public EiAnalysisRepository(ResourceJsonLoader jsonLoader) {
    TypeReference<Map<String, EiStateDocument>> type = new TypeReference<>() {};
    Map<String, EiStateDocument> raw = jsonLoader.readResource(RESOURCE, type);
    this.statesByCode = jsonLoader.normalizeKeys(raw);
  }

  public EiStateDocument findByStateCode(String stateCode) {
    return statesByCode.get(stateCode);
  }
}
