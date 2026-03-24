package app.repository;

import app.domain.EnsembleBoxplotDocument;
import app.repository.mongo.EnsembleBoxplotMongoRepository;
import org.springframework.stereotype.Repository;

@Repository
public class EnsembleBoxplotRepository {
  private final EnsembleBoxplotMongoRepository mongoRepository;

  public EnsembleBoxplotRepository(EnsembleBoxplotMongoRepository mongoRepository) {
    this.mongoRepository = mongoRepository;
  }

  public EnsembleBoxplotDocument findByStateCode(String stateCode) {
    return mongoRepository.findByStateCode(stateCode)
        .map(document -> document.boxplot())
        .orElse(null);
  }
}
