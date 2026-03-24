package app.repository;

import app.domain.DistrictRepresentationDocument;
import app.repository.support.ResourceJsonLoader;
import com.fasterxml.jackson.core.type.TypeReference;
import java.util.List;
import java.util.Map;
import org.springframework.stereotype.Repository;

@Repository
public class DistrictRepresentationRepository {
  private static final String RESOURCE = "representation.json";

  private final Map<String, List<DistrictRepresentationDocument>> rowsByStateCode;

  public DistrictRepresentationRepository(ResourceJsonLoader jsonLoader) {
    TypeReference<Map<String, List<DistrictRepresentationDocument>>> type = new TypeReference<>() {};
    Map<String, List<DistrictRepresentationDocument>> raw = jsonLoader.readResource(RESOURCE, type);
    this.rowsByStateCode = jsonLoader.normalizeKeys(raw);
  }

  public List<DistrictRepresentationDocument> findByStateCode(String stateCode) {
    return rowsByStateCode.get(stateCode);
  }
}
