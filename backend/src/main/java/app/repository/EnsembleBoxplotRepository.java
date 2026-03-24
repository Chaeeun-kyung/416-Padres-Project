package app.repository;

import app.domain.EnsembleBoxplotDocument;
import app.repository.support.ResourceJsonLoader;
import com.fasterxml.jackson.core.type.TypeReference;
import java.util.Map;
import org.springframework.stereotype.Repository;

@Repository
public class EnsembleBoxplotRepository {
  private static final String RESOURCE = "ensemble-boxplot.json";

  private final Map<String, EnsembleBoxplotDocument> boxplotsByStateCode;

  public EnsembleBoxplotRepository(ResourceJsonLoader jsonLoader) {
    TypeReference<Map<String, EnsembleBoxplotDocument>> type = new TypeReference<>() {};
    Map<String, EnsembleBoxplotDocument> raw = jsonLoader.readResource(RESOURCE, type);
    this.boxplotsByStateCode = jsonLoader.normalizeKeys(raw);
  }

  public EnsembleBoxplotDocument findByStateCode(String stateCode) {
    return boxplotsByStateCode.get(stateCode);
  }
}
