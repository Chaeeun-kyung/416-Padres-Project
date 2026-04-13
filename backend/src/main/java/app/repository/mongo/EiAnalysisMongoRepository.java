package app.repository.mongo;

import app.repository.mongo.document.EiAnalysisMongoDocument;
import java.util.Optional;
import org.springframework.data.mongodb.repository.MongoRepository;

public interface EiAnalysisMongoRepository extends MongoRepository<EiAnalysisMongoDocument, String> {
  Optional<EiAnalysisMongoDocument> findByStateCodeAndGroupKey(String stateCode, String groupKey);
}
