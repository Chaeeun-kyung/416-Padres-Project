package app.repository;

import app.domain.EnsembleSplitsDocument;
import app.repository.support.ResourceJsonLoader;
import com.fasterxml.jackson.core.type.TypeReference;
import java.util.Map;
import org.springframework.stereotype.Repository;

@Repository
public class EnsembleSplitRepository {
  private static final String RESOURCE = "ensemble-splits.json";

  private final Map<String, EnsembleSplitsDocument> splitsByStateCode;

  public EnsembleSplitRepository(ResourceJsonLoader jsonLoader) {
    TypeReference<Map<String, EnsembleSplitsDocument>> type = new TypeReference<>() {};
    Map<String, EnsembleSplitsDocument> raw = jsonLoader.readResource(RESOURCE, type);
    this.splitsByStateCode = jsonLoader.normalizeKeys(raw);
  }

  public EnsembleSplitsDocument findByStateCode(String stateCode) {
    return splitsByStateCode.get(stateCode);
  }
}
