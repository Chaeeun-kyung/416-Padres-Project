package app.bootstrap;

import app.domain.DistrictRepresentationDocument;
import app.domain.EiGroupDocument;
import app.domain.EiStateDocument;
import app.domain.EnsembleBoxplotDocument;
import app.domain.EnsembleSplitsDocument;
import app.domain.GinglesAnalysisDocument;
import app.domain.GinglesGroupDocument;
import app.domain.GinglesStateDocument;
import app.domain.StateSummaryDocument;
import app.repository.mongo.EiAnalysisMongoRepository;
import app.repository.mongo.EnsembleBoxplotMongoRepository;
import app.repository.mongo.EnsembleSplitsMongoRepository;
import app.repository.mongo.GinglesAnalysisMongoRepository;
import app.repository.mongo.RepresentationMongoRepository;
import app.repository.mongo.StateSummaryMongoRepository;
import app.repository.mongo.document.EiAnalysisMongoDocument;
import app.repository.mongo.document.EnsembleBoxplotMongoDocument;
import app.repository.mongo.document.EnsembleSplitsMongoDocument;
import app.repository.mongo.document.GinglesAnalysisMongoDocument;
import app.repository.mongo.document.RepresentationMongoDocument;
import app.repository.mongo.document.StateSummaryMongoDocument;
import com.fasterxml.jackson.core.type.TypeReference;
import java.util.List;
import java.util.Map;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.data.domain.Sort;
import org.springframework.data.mongodb.core.MongoTemplate;
import org.springframework.data.mongodb.core.index.Index;
import org.springframework.data.mongodb.core.index.IndexInfo;
import org.springframework.stereotype.Component;

@Component
@ConditionalOnProperty(
    value = "app.seed.preprocessed-data-on-startup",
    havingValue = "true",
    matchIfMissing = true
)
public class PreprocessedDataMongoSeeder implements ApplicationRunner {
  private static final Logger LOGGER = LoggerFactory.getLogger(PreprocessedDataMongoSeeder.class);
  private static final List<String> AVAILABLE_GROUP_KEYS = List.of("white_pct", "latino_pct");

  private final ResourceJsonLoader jsonLoader;
  private final MongoTemplate mongoTemplate;
  private final StateSummaryMongoRepository stateSummaryMongoRepository;
  private final GinglesAnalysisMongoRepository ginglesAnalysisMongoRepository;
  private final EiAnalysisMongoRepository eiAnalysisMongoRepository;
  private final EnsembleSplitsMongoRepository ensembleSplitsMongoRepository;
  private final EnsembleBoxplotMongoRepository ensembleBoxplotMongoRepository;
  private final RepresentationMongoRepository representationMongoRepository;

  public PreprocessedDataMongoSeeder(
      ResourceJsonLoader jsonLoader,
      MongoTemplate mongoTemplate,
      StateSummaryMongoRepository stateSummaryMongoRepository,
      GinglesAnalysisMongoRepository ginglesAnalysisMongoRepository,
      EiAnalysisMongoRepository eiAnalysisMongoRepository,
      EnsembleSplitsMongoRepository ensembleSplitsMongoRepository,
      EnsembleBoxplotMongoRepository ensembleBoxplotMongoRepository,
      RepresentationMongoRepository representationMongoRepository
  ) {
    this.jsonLoader = jsonLoader;
    this.mongoTemplate = mongoTemplate;
    this.stateSummaryMongoRepository = stateSummaryMongoRepository;
    this.ginglesAnalysisMongoRepository = ginglesAnalysisMongoRepository;
    this.eiAnalysisMongoRepository = eiAnalysisMongoRepository;
    this.ensembleSplitsMongoRepository = ensembleSplitsMongoRepository;
    this.ensembleBoxplotMongoRepository = ensembleBoxplotMongoRepository;
    this.representationMongoRepository = representationMongoRepository;
  }

  @Override
  public void run(ApplicationArguments args) {
    seedStateSummaries();
    seedGinglesAnalysis();
    seedEiAnalysis();
    seedEnsembleSplits();
    seedEnsembleBoxplots();
    seedDistrictRepresentation();
    LOGGER.info("MongoDB preprocessed-data seeding complete.");
  }

  private void seedStateSummaries() {
    stateSummaryMongoRepository.deleteAll();

    TypeReference<Map<String, StateSummaryDocument>> type = new TypeReference<>() {};
    Map<String, StateSummaryDocument> raw = jsonLoader.readResource("state-summary.json", type);
    Map<String, StateSummaryDocument> normalized = jsonLoader.normalizeKeys(raw);

    normalized.forEach((stateCode, summary) ->
        stateSummaryMongoRepository.save(new StateSummaryMongoDocument(stateCode, stateCode, summary))
    );

    LOGGER.info("Seeded {} state summary document(s).", normalized.size());
  }

  private void seedGinglesAnalysis() {
    ginglesAnalysisMongoRepository.deleteAll();

    TypeReference<GinglesAnalysisDocument> type = new TypeReference<>() {};
    GinglesAnalysisDocument root = jsonLoader.readResource("gingles-analysis.json", type);
    Map<String, GinglesStateDocument> normalized = jsonLoader.normalizeKeys(root.states());

    int savedCount = 0;
    for (Map.Entry<String, GinglesStateDocument> stateEntry : normalized.entrySet()) {
      String stateCode = stateEntry.getKey();
      Map<String, GinglesGroupDocument> groups = stateEntry.getValue().groups();
      if (groups == null) {
        continue;
      }

      for (Map.Entry<String, GinglesGroupDocument> groupEntry : groups.entrySet()) {
        String groupKey = groupEntry.getKey();
        GinglesGroupDocument groupDocument = groupEntry.getValue();
        ginglesAnalysisMongoRepository.save(
            new GinglesAnalysisMongoDocument(
                stateCode + "::" + groupKey,
                stateCode,
                groupKey,
                groupDocument
            )
        );
        savedCount += 1;
      }
    }

    LOGGER.info("Seeded {} gingles analysis document(s).", savedCount);
  }

  private void seedEiAnalysis() {
    eiAnalysisMongoRepository.deleteAll();

    TypeReference<Map<String, EiStateDocument>> type = new TypeReference<>() {};
    Map<String, EiStateDocument> raw = jsonLoader.readResource("ei-analysis.json", type);
    Map<String, EiStateDocument> normalized = jsonLoader.normalizeKeys(raw);

    int savedCount = 0;
    for (Map.Entry<String, EiStateDocument> stateEntry : normalized.entrySet()) {
      String stateCode = stateEntry.getKey();
      Map<String, EiGroupDocument> groups = stateEntry.getValue().groups();
      if (groups == null) {
        continue;
      }

      for (Map.Entry<String, EiGroupDocument> groupEntry : groups.entrySet()) {
        String groupKey = groupEntry.getKey();
        EiGroupDocument groupDocument = groupEntry.getValue();
        eiAnalysisMongoRepository.save(
            new EiAnalysisMongoDocument(
                stateCode + "::" + groupKey,
                stateCode,
                groupKey,
                groupDocument
            )
        );
        savedCount += 1;
      }
    }

    LOGGER.info("Seeded {} EI analysis document(s).", savedCount);
  }

  private void seedEnsembleSplits() {
    ensembleSplitsMongoRepository.deleteAll();

    TypeReference<Map<String, EnsembleSplitsDocument>> type = new TypeReference<>() {};
    Map<String, EnsembleSplitsDocument> raw = jsonLoader.readResource("ensemble-splits.json", type);
    Map<String, EnsembleSplitsDocument> normalized = jsonLoader.normalizeKeys(raw);

    normalized.forEach((stateCode, splits) ->
        ensembleSplitsMongoRepository.save(new EnsembleSplitsMongoDocument(stateCode, stateCode, splits))
    );

    LOGGER.info("Seeded {} ensemble split document(s).", normalized.size());
  }

  private void seedEnsembleBoxplots() {
    migrateEnsembleBoxplotIndexes();
    ensembleBoxplotMongoRepository.deleteAll();

    // ensemble-boxplot.json format: { state -> { groupKey -> { ensembleKey -> { distributions, enacted } } } }
    TypeReference<Map<String, Map<String, Map<String, EnsembleBoxplotDocument>>>> type = new TypeReference<>() {};
    Map<String, Map<String, Map<String, EnsembleBoxplotDocument>>> raw = jsonLoader.readResource("ensemble-boxplot.json", type);
    Map<String, Map<String, Map<String, EnsembleBoxplotDocument>>> byState = jsonLoader.normalizeKeys(raw);

    int savedCount = 0;
    for (Map.Entry<String, Map<String, Map<String, EnsembleBoxplotDocument>>> stateEntry : byState.entrySet()) {
      String stateCode = stateEntry.getKey();
      Map<String, Map<String, EnsembleBoxplotDocument>> groupMap = stateEntry.getValue();

      for (Map.Entry<String, Map<String, EnsembleBoxplotDocument>> groupEntry : groupMap.entrySet()) {
        String groupKey = groupEntry.getKey();
        Map<String, EnsembleBoxplotDocument> ensembleMap = groupEntry.getValue();

        for (Map.Entry<String, EnsembleBoxplotDocument> ensembleEntry : ensembleMap.entrySet()) {
          String ensembleKey = ensembleEntry.getKey();
          EnsembleBoxplotDocument doc = ensembleEntry.getValue();
          Map<String, Double> enacted = doc.enacted() != null ? doc.enacted() : Map.of();
          Map<String, List<Double>> distributions = doc.distributions() != null ? doc.distributions() : Map.of();
          List<String> districtOrder = enacted.entrySet().stream()
              .sorted((a, b) -> {
                int cmp = Double.compare(a.getValue(), b.getValue());
                return cmp != 0 ? cmp : a.getKey().compareTo(b.getKey());
              })
              .map(Map.Entry::getKey)
              .toList();

          ensembleBoxplotMongoRepository.save(
              new EnsembleBoxplotMongoDocument(
                  stateCode + "::" + groupKey + "::" + ensembleKey,
                  stateCode,
                  groupKey,
                  ensembleKey,
                  districtOrder,
                  distributions,
                  enacted
              )
          );
          savedCount += 1;
        }
      }
    }

    LOGGER.info("Seeded {} ensemble boxplot variant document(s).", savedCount);
  }

  private void seedDistrictRepresentation() {
    representationMongoRepository.deleteAll();

    TypeReference<Map<String, List<DistrictRepresentationDocument>>> type = new TypeReference<>() {};
    Map<String, List<DistrictRepresentationDocument>> raw = jsonLoader.readResource("representation.json", type);
    Map<String, List<DistrictRepresentationDocument>> normalized = jsonLoader.normalizeKeys(raw);

    normalized.forEach((stateCode, rows) ->
        representationMongoRepository.save(new RepresentationMongoDocument(stateCode, stateCode, rows))
    );

    LOGGER.info("Seeded {} district representation document(s).", normalized.size());
  }

  private void migrateEnsembleBoxplotIndexes() {
    var indexOps = mongoTemplate.indexOps(EnsembleBoxplotMongoDocument.class);

    for (IndexInfo indexInfo : indexOps.getIndexInfo()) {
      boolean legacyStateOnlyIndex = indexInfo.isUnique()
          && indexInfo.getIndexFields().size() == 1
          && "stateCode".equals(indexInfo.getIndexFields().get(0).getKey());

      if (legacyStateOnlyIndex) {
        indexOps.dropIndex(indexInfo.getName());
        LOGGER.info("Dropped legacy ensemble_boxplots index '{}'.", indexInfo.getName());
      }
    }

    indexOps.ensureIndex(new Index()
        .on("stateCode", Sort.Direction.ASC)
        .on("groupKey", Sort.Direction.ASC)
        .on("ensembleKey", Sort.Direction.ASC)
        .unique()
        .named("ensemble_boxplot_variant_idx"));
  }
}
