package app.repository.mongo;

import app.repository.mongo.document.GinglesAnalysisMongoDocument;
import java.util.Optional;
import org.springframework.data.mongodb.repository.MongoRepository;

public interface GinglesAnalysisMongoRepository extends MongoRepository<GinglesAnalysisMongoDocument, String> {
  Optional<GinglesAnalysisMongoDocument> findByStateCodeAndGroupKey(String stateCode, String groupKey);
}
