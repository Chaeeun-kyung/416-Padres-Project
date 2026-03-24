package app.repository;

import app.domain.GinglesStateDocument;
import app.repository.mongo.GinglesStateMongoRepository;
import org.springframework.stereotype.Repository;

@Repository
public class GinglesAnalysisRepository {
  private final GinglesStateMongoRepository mongoRepository;

  public GinglesAnalysisRepository(GinglesStateMongoRepository mongoRepository) {
    this.mongoRepository = mongoRepository;
  }

  public GinglesStateDocument findByStateCode(String stateCode) {
    return mongoRepository.findByStateCode(stateCode)
        .map(document -> document.state())
        .orElse(null);
  }
}
