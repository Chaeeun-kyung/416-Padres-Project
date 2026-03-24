package app.repository;

import app.domain.EiStateDocument;
import app.repository.mongo.EiStateMongoRepository;
import org.springframework.stereotype.Repository;

@Repository
public class EiAnalysisRepository {
  private final EiStateMongoRepository mongoRepository;

  public EiAnalysisRepository(EiStateMongoRepository mongoRepository) {
    this.mongoRepository = mongoRepository;
  }

  public EiStateDocument findByStateCode(String stateCode) {
    return mongoRepository.findByStateCode(stateCode)
        .map(document -> document.state())
        .orElse(null);
  }
}
