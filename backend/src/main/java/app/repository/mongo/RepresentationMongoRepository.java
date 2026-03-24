package app.repository.mongo;

import app.repository.mongo.document.RepresentationMongoDocument;
import java.util.Optional;
import org.springframework.data.mongodb.repository.MongoRepository;

public interface RepresentationMongoRepository extends MongoRepository<RepresentationMongoDocument, String> {
  Optional<RepresentationMongoDocument> findByStateCode(String stateCode);
}
