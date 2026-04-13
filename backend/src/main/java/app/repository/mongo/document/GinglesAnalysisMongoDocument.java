package app.repository.mongo.document;

import app.domain.GinglesGroupDocument;
import org.springframework.data.annotation.Id;
import org.springframework.data.mongodb.core.index.CompoundIndex;
import org.springframework.data.mongodb.core.mapping.Document;

@Document(collection = "gingles_analysis")
@CompoundIndex(name = "gingles_state_group_idx", def = "{'stateCode': 1, 'groupKey': 1}", unique = true)
public record GinglesAnalysisMongoDocument(
    @Id String id,
    String stateCode,
    String groupKey,
    GinglesGroupDocument analysis
) {
}
