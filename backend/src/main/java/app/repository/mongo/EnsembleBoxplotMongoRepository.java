package app.repository.mongo;

import app.repository.mongo.document.EnsembleBoxplotMongoDocument;
import java.util.Optional;
import org.springframework.data.mongodb.repository.MongoRepository;

public interface EnsembleBoxplotMongoRepository extends MongoRepository<EnsembleBoxplotMongoDocument, String> {
  Optional<EnsembleBoxplotMongoDocument> findByStateCodeAndGroupKeyAndEnsembleKey(
      String stateCode,
      String groupKey,
      String ensembleKey
  );
}
