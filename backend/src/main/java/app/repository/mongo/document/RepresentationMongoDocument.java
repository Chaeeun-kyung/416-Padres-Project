package app.repository.mongo.document;

import app.domain.DistrictRepresentationDocument;
import java.util.List;
import org.springframework.data.annotation.Id;
import org.springframework.data.mongodb.core.index.Indexed;
import org.springframework.data.mongodb.core.mapping.Document;

@Document(collection = "district_representations")
public record RepresentationMongoDocument(
    @Id String id,
    @Indexed(unique = true) String stateCode,
    List<DistrictRepresentationDocument> rows
) {
}
