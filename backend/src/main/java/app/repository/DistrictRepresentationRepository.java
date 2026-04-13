package app.repository;

import app.domain.DistrictRepresentationDocument;
import java.util.List;
import app.repository.mongo.RepresentationMongoRepository;
import org.springframework.stereotype.Repository;

@Repository
public class DistrictRepresentationRepository {
  private final RepresentationMongoRepository mongoRepository;

  public DistrictRepresentationRepository(RepresentationMongoRepository mongoRepository) {
    this.mongoRepository = mongoRepository;
  }

  public List<DistrictRepresentationDocument> findByStateCode(String stateCode) {
    return mongoRepository.findByStateCode(stateCode)
        .map(document -> document.rows())
        .orElse(null);
  }
}
