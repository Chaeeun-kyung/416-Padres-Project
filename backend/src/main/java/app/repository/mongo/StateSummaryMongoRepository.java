package app.repository.mongo;

import app.repository.mongo.document.StateSummaryMongoDocument;
import java.util.Optional;
import org.springframework.data.mongodb.repository.MongoRepository;

public interface StateSummaryMongoRepository extends MongoRepository<StateSummaryMongoDocument, String> {
  Optional<StateSummaryMongoDocument> findByStateCode(String stateCode);
}
