package app.repository.mongo;

import app.repository.mongo.document.EiStateMongoDocument;
import java.util.Optional;
import org.springframework.data.mongodb.repository.MongoRepository;

public interface EiStateMongoRepository extends MongoRepository<EiStateMongoDocument, String> {
  Optional<EiStateMongoDocument> findByStateCode(String stateCode);
}
