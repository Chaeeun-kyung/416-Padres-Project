package app.repository;

import app.domain.StateSummaryDocument;
import app.repository.mongo.StateSummaryMongoRepository;
import org.springframework.stereotype.Repository;

@Repository
public class StateSummaryRepository {
  private final StateSummaryMongoRepository mongoRepository;

  public StateSummaryRepository(StateSummaryMongoRepository mongoRepository) {
    this.mongoRepository = mongoRepository;
  }

  public StateSummaryDocument findByStateCode(String stateCode) {
    return mongoRepository.findByStateCode(stateCode)
        .map(document -> document.summary())
        .orElse(null);
  }
}
