package app.repository.mongo.document;

import app.domain.GinglesStateDocument;
import org.springframework.data.annotation.Id;
import org.springframework.data.mongodb.core.index.Indexed;
import org.springframework.data.mongodb.core.mapping.Document;

@Document(collection = "gingles_states")
public record GinglesStateMongoDocument(
    @Id String id,
    @Indexed(unique = true) String stateCode,
    GinglesStateDocument state
) {
}
