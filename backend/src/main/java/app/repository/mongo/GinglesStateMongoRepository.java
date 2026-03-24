package app.repository.mongo;

import app.repository.mongo.document.GinglesStateMongoDocument;
import java.util.Optional;
import org.springframework.data.mongodb.repository.MongoRepository;

public interface GinglesStateMongoRepository extends MongoRepository<GinglesStateMongoDocument, String> {
  Optional<GinglesStateMongoDocument> findByStateCode(String stateCode);
}
