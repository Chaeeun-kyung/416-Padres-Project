package app.repository.mongo.document;

import app.domain.EiGroupDocument;
import org.springframework.data.annotation.Id;
import org.springframework.data.mongodb.core.index.CompoundIndex;
import org.springframework.data.mongodb.core.mapping.Document;

@Document(collection = "ei_analysis")
@CompoundIndex(name = "ei_state_group_idx", def = "{'stateCode': 1, 'groupKey': 1}", unique = true)
public record EiAnalysisMongoDocument(
    @Id String id,
    String stateCode,
    String groupKey,
    EiGroupDocument analysis
) {
}
