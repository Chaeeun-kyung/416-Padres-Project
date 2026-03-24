package app.repository;

import app.domain.GinglesAnalysisDocument;
import app.domain.GinglesStateDocument;
import app.repository.support.ResourceJsonLoader;
import com.fasterxml.jackson.core.type.TypeReference;
import java.util.Map;
import org.springframework.stereotype.Repository;

@Repository
public class GinglesAnalysisRepository {
  private static final String RESOURCE = "gingles-analysis.json";

  private final Map<String, GinglesStateDocument> statesByCode;

  public GinglesAnalysisRepository(ResourceJsonLoader jsonLoader) {
    TypeReference<GinglesAnalysisDocument> type = new TypeReference<>() {};
    GinglesAnalysisDocument document = jsonLoader.readResource(RESOURCE, type);
    this.statesByCode = jsonLoader.normalizeKeys(document.states());
  }

  public GinglesStateDocument findByStateCode(String stateCode) {
    return statesByCode.get(stateCode);
  }
}
