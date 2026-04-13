package app.repository.mongo.document;

import java.util.List;
import java.util.Map;
import org.springframework.data.annotation.Id;
import org.springframework.data.mongodb.core.index.CompoundIndex;
import org.springframework.data.mongodb.core.mapping.Document;

@Document(collection = "ensemble_boxplots")
@CompoundIndex(
    name = "ensemble_boxplot_variant_idx",
    def = "{'stateCode': 1, 'groupKey': 1, 'ensembleKey': 1}",
    unique = true
)
public record EnsembleBoxplotMongoDocument(
    @Id String id,
    String stateCode,
    String groupKey,
    String ensembleKey,
    List<String> districtOrder,
    Map<String, List<Double>> distributions,
    Map<String, Double> enacted
) {
}
