package app.repository;

import app.domain.EnsembleSplitsDocument;
import app.repository.mongo.EnsembleSplitsMongoRepository;
import org.springframework.stereotype.Repository;

@Repository
public class EnsembleSplitsRepository {
  private final EnsembleSplitsMongoRepository mongoRepository;

  public EnsembleSplitsRepository(EnsembleSplitsMongoRepository mongoRepository) {
    this.mongoRepository = mongoRepository;
  }

  public EnsembleSplitsDocument findByStateCode(String stateCode) {
    return mongoRepository.findByStateCode(stateCode)
        .map(document -> document.splits())
        .orElse(null);
  }
}
