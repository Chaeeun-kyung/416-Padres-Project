package app.repository;

import app.domain.EnsembleBoxplotVariantDocument;
import app.repository.mongo.EnsembleBoxplotMongoRepository;
import org.springframework.stereotype.Repository;

@Repository
public class EnsembleBoxplotRepository {
  private final EnsembleBoxplotMongoRepository mongoRepository;

  public EnsembleBoxplotRepository(EnsembleBoxplotMongoRepository mongoRepository) {
    this.mongoRepository = mongoRepository;
  }

  public EnsembleBoxplotVariantDocument findByStateCodeAndGroupKeyAndEnsembleKey(
      String stateCode,
      String groupKey,
      String ensembleKey
  ) {
    return mongoRepository.findByStateCodeAndGroupKeyAndEnsembleKey(stateCode, groupKey, ensembleKey)
        .map(document -> new EnsembleBoxplotVariantDocument(
            document.stateCode(),
            document.groupKey(),
            document.ensembleKey(),
            document.districtOrder(),
            document.distributions(),
            document.enacted()
        ))
        .orElse(null);
  }
}
