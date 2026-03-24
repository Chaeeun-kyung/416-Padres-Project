package app.repository.mongo.document;

import app.domain.EnsembleSplitsDocument;
import org.springframework.data.annotation.Id;
import org.springframework.data.mongodb.core.index.Indexed;
import org.springframework.data.mongodb.core.mapping.Document;

@Document(collection = "ensemble_splits")
public record EnsembleSplitsMongoDocument(
    @Id String id,
    @Indexed(unique = true) String stateCode,
    EnsembleSplitsDocument splits
) {
}
