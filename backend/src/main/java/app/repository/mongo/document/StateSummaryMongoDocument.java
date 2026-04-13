package app.repository.mongo.document;

import app.domain.StateSummaryDocument;
import org.springframework.data.annotation.Id;
import org.springframework.data.mongodb.core.index.Indexed;
import org.springframework.data.mongodb.core.mapping.Document;

@Document(collection = "state_summaries")
public record StateSummaryMongoDocument(
    @Id String id,
    @Indexed(unique = true) String stateCode,
    StateSummaryDocument summary
) {
}
