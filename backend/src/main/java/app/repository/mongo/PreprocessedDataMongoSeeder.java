package app.repository.mongo;

import app.domain.DistrictRepresentationDocument;
import app.domain.EiStateDocument;
import app.domain.EnsembleBoxplotDocument;
import app.domain.EnsembleSplitsDocument;
import app.domain.GinglesAnalysisDocument;
import app.domain.GinglesStateDocument;
import app.domain.StateSummaryDocument;
import app.repository.mongo.document.EiStateMongoDocument;
import app.repository.mongo.document.EnsembleBoxplotMongoDocument;
import app.repository.mongo.document.EnsembleSplitsMongoDocument;
import app.repository.mongo.document.GinglesStateMongoDocument;
import app.repository.mongo.document.RepresentationMongoDocument;
import app.repository.mongo.document.StateSummaryMongoDocument;
import app.repository.support.ResourceJsonLoader;
import com.fasterxml.jackson.core.type.TypeReference;
import java.util.List;
import java.util.Map;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.stereotype.Component;

@Component
@ConditionalOnProperty(
    value = "app.seed.preprocessed-data-on-startup",
    havingValue = "true",
    matchIfMissing = true
)
public class PreprocessedDataMongoSeeder implements ApplicationRunner {
  private static final Logger LOGGER = LoggerFactory.getLogger(PreprocessedDataMongoSeeder.class);

  private final boolean seedSyntheticAnalysisData;
  private final ResourceJsonLoader jsonLoader;
  private final StateSummaryMongoRepository stateSummaryMongoRepository;
  private final GinglesStateMongoRepository ginglesStateMongoRepository;
  private final EiStateMongoRepository eiStateMongoRepository;
  private final EnsembleSplitsMongoRepository ensembleSplitsMongoRepository;
  private final EnsembleBoxplotMongoRepository ensembleBoxplotMongoRepository;
  private final RepresentationMongoRepository representationMongoRepository;

  public PreprocessedDataMongoSeeder(
      @Value("${app.seed.synthetic-analysis-data-on-startup:false}") boolean seedSyntheticAnalysisData,
      ResourceJsonLoader jsonLoader,
      StateSummaryMongoRepository stateSummaryMongoRepository,
      GinglesStateMongoRepository ginglesStateMongoRepository,
      EiStateMongoRepository eiStateMongoRepository,
      EnsembleSplitsMongoRepository ensembleSplitsMongoRepository,
      EnsembleBoxplotMongoRepository ensembleBoxplotMongoRepository,
      RepresentationMongoRepository representationMongoRepository
  ) {
    this.seedSyntheticAnalysisData = seedSyntheticAnalysisData;
    this.jsonLoader = jsonLoader;
    this.stateSummaryMongoRepository = stateSummaryMongoRepository;
    this.ginglesStateMongoRepository = ginglesStateMongoRepository;
    this.eiStateMongoRepository = eiStateMongoRepository;
    this.ensembleSplitsMongoRepository = ensembleSplitsMongoRepository;
    this.ensembleBoxplotMongoRepository = ensembleBoxplotMongoRepository;
    this.representationMongoRepository = representationMongoRepository;
  }

  @Override
  public void run(ApplicationArguments args) {
    seedStateSummaries();
    seedGinglesAnalysis();
    if (seedSyntheticAnalysisData) {
      seedEiAnalysis();
      seedEnsembleSplits();
      seedEnsembleBoxplots();
    } else {
      LOGGER.info("Skipping EI + ensemble startup seed (app.seed.synthetic-analysis-data-on-startup=false).");
    }
    seedDistrictRepresentation();
    LOGGER.info("MongoDB preprocessed-data seeding complete.");
  }

  private void seedStateSummaries() {
    TypeReference<Map<String, StateSummaryDocument>> type = new TypeReference<>() {};
    Map<String, StateSummaryDocument> raw = jsonLoader.readResource("state-summary.json", type);
    Map<String, StateSummaryDocument> normalized = jsonLoader.normalizeKeys(raw);

    normalized.forEach((stateCode, summary) ->
        stateSummaryMongoRepository.save(new StateSummaryMongoDocument(stateCode, stateCode, summary))
    );

    LOGGER.info("Seeded {} state summary document(s).", normalized.size());
  }

  private void seedGinglesAnalysis() {
    TypeReference<GinglesAnalysisDocument> type = new TypeReference<>() {};
    GinglesAnalysisDocument root = jsonLoader.readResource("gingles-analysis.json", type);
    Map<String, GinglesStateDocument> normalized = jsonLoader.normalizeKeys(root.states());

    normalized.forEach((stateCode, stateData) ->
        ginglesStateMongoRepository.save(new GinglesStateMongoDocument(stateCode, stateCode, stateData))
    );

    LOGGER.info("Seeded {} gingles state document(s).", normalized.size());
  }

  private void seedEiAnalysis() {
    TypeReference<Map<String, EiStateDocument>> type = new TypeReference<>() {};
    Map<String, EiStateDocument> raw = jsonLoader.readResource("ei-analysis.json", type);
    Map<String, EiStateDocument> normalized = jsonLoader.normalizeKeys(raw);

    normalized.forEach((stateCode, stateData) ->
        eiStateMongoRepository.save(new EiStateMongoDocument(stateCode, stateCode, stateData))
    );

    LOGGER.info("Seeded {} EI state document(s).", normalized.size());
  }

  private void seedEnsembleSplits() {
    TypeReference<Map<String, EnsembleSplitsDocument>> type = new TypeReference<>() {};
    Map<String, EnsembleSplitsDocument> raw = jsonLoader.readResource("ensemble-splits.json", type);
    Map<String, EnsembleSplitsDocument> normalized = jsonLoader.normalizeKeys(raw);

    normalized.forEach((stateCode, splits) ->
        ensembleSplitsMongoRepository.save(new EnsembleSplitsMongoDocument(stateCode, stateCode, splits))
    );

    LOGGER.info("Seeded {} ensemble split document(s).", normalized.size());
  }

  private void seedEnsembleBoxplots() {
    TypeReference<Map<String, EnsembleBoxplotDocument>> type = new TypeReference<>() {};
    Map<String, EnsembleBoxplotDocument> raw = jsonLoader.readResource("ensemble-boxplot.json", type);
    Map<String, EnsembleBoxplotDocument> normalized = jsonLoader.normalizeKeys(raw);

    normalized.forEach((stateCode, boxplot) ->
        ensembleBoxplotMongoRepository.save(new EnsembleBoxplotMongoDocument(stateCode, stateCode, boxplot))
    );

    LOGGER.info("Seeded {} ensemble boxplot document(s).", normalized.size());
  }

  private void seedDistrictRepresentation() {
    TypeReference<Map<String, List<DistrictRepresentationDocument>>> type = new TypeReference<>() {};
    Map<String, List<DistrictRepresentationDocument>> raw = jsonLoader.readResource("representation.json", type);
    Map<String, List<DistrictRepresentationDocument>> normalized = jsonLoader.normalizeKeys(raw);

    normalized.forEach((stateCode, rows) ->
        representationMongoRepository.save(new RepresentationMongoDocument(stateCode, stateCode, rows))
    );

    LOGGER.info("Seeded {} district representation document(s).", normalized.size());
  }
}
