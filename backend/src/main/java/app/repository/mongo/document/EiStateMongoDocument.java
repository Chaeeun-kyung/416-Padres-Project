package app.repository.mongo.document;

import app.domain.EiStateDocument;
import org.springframework.data.annotation.Id;
import org.springframework.data.mongodb.core.index.Indexed;
import org.springframework.data.mongodb.core.mapping.Document;

@Document(collection = "ei_states")
public record EiStateMongoDocument(
    @Id String id,
    @Indexed(unique = true) String stateCode,
    EiStateDocument state
) {
}
