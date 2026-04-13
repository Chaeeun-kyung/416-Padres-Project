package app.repository;

import app.domain.GinglesGroupDocument;
import app.repository.mongo.GinglesAnalysisMongoRepository;
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
}
