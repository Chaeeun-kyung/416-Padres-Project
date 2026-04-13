package app.repository;

import app.domain.EiGroupDocument;
import app.repository.mongo.EiAnalysisMongoRepository;
import org.springframework.stereotype.Repository;

@Repository
public class EiAnalysisRepository {
  private final EiAnalysisMongoRepository mongoRepository;

  public EiAnalysisRepository(EiAnalysisMongoRepository mongoRepository) {
    this.mongoRepository = mongoRepository;
  }

  public EiGroupDocument findByStateCodeAndGroupKey(String stateCode, String groupKey) {
    return mongoRepository.findByStateCodeAndGroupKey(stateCode, groupKey)
        .map(document -> document.analysis())
        .orElse(null);
  }
}
