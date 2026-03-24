package app.repository.mongo;

import app.repository.mongo.document.EnsembleSplitsMongoDocument;
import java.util.Optional;
import org.springframework.data.mongodb.repository.MongoRepository;

public interface EnsembleSplitsMongoRepository extends MongoRepository<EnsembleSplitsMongoDocument, String> {
  Optional<EnsembleSplitsMongoDocument> findByStateCode(String stateCode);
}
