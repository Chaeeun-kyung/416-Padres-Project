package app.repository;

import app.domain.GinglesGroupDocument;
import app.repository.mongo.GinglesAnalysisMongoRepository;
import java.util.Comparator;
import java.util.List;
import org.springframework.stereotype.Repository;

@Repository
public class GinglesAnalysisRepository {
  private final GinglesAnalysisMongoRepository mongoRepository;

  public GinglesAnalysisRepository(GinglesAnalysisMongoRepository mongoRepository) {
    this.mongoRepository = mongoRepository;
  }

  public GinglesGroupDocument findByStateCodeAndGroupKey(String stateCode, String groupKey) {
    return mongoRepository.findByStateCodeAndGroupKey(stateCode, groupKey)
        .map(document -> document.analysis())
        .orElse(null);
  }

  public List<String> findGroupKeysByStateCode(String stateCode) {
    return mongoRepository.findAllByStateCode(stateCode).stream()
        .map(document -> document.groupKey())
        .filter(groupKey -> groupKey != null && !groupKey.isBlank())
        .distinct()
        .sorted(Comparator.naturalOrder())
        .toList();
  }
}
