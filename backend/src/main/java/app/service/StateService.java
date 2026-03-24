package app.service;

import app.domain.CongressionalPartySummaryDocument;
import app.domain.EnsembleSummaryDocument;
import app.domain.StateSummaryDocument;
import app.domain.VoterDistributionDocument;
import app.dto.CongressionalPartySummaryResponse;
import app.dto.EnsembleSummaryResponse;
import app.dto.StateSummaryResponse;
import app.dto.VoterDistributionResponse;
import app.exception.BadRequestException;
import app.exception.ResourceNotFoundException;
import app.repository.StateSummaryRepository;
import org.springframework.stereotype.Service;

@Service
public class StateService {

  private final StateSummaryRepository stateSummaryRepository;

  public StateService(StateSummaryRepository stateSummaryRepository) {
    this.stateSummaryRepository = stateSummaryRepository;
  }

  public StateSummaryResponse getSummary(String rawStateCode) {
    String stateCode = normalizeStateCode(rawStateCode);
    StateSummaryDocument document = stateSummaryRepository.findByStateCode(stateCode);
    if (document == null) {
      throw new ResourceNotFoundException("State summary not found for state " + stateCode);
    }

    return new StateSummaryResponse(
        document.stateCode(),
        document.districts(),
        document.votingAgePopulation(),
        document.racialEthnicPopulationPct(),
        document.racialEthnicPopulationMillions(),
        mapVoterDistribution(document.voterDistribution()),
        mapEnsembleSummary(document.ensembleSummary()),
        document.redistrictingControl(),
        mapPartySummary(document.congressionalPartySummary())
    );
  }

  private CongressionalPartySummaryResponse mapPartySummary(CongressionalPartySummaryDocument document) {
    if (document == null) {
      return null;
    }
    return new CongressionalPartySummaryResponse(document.democrats(), document.republicans());
  }

  private VoterDistributionResponse mapVoterDistribution(VoterDistributionDocument document) {
    if (document == null) {
      return null;
    }
    return new VoterDistributionResponse(
        document.demVotes(),
        document.repVotes(),
        document.totalVotes(),
        document.demPct(),
        document.repPct()
    );
  }

  private EnsembleSummaryResponse mapEnsembleSummary(EnsembleSummaryDocument document) {
    if (document == null) {
      return null;
    }
    return new EnsembleSummaryResponse(
        document.raceBlindPlans(),
        document.vraConstrainedPlans(),
        document.populationEqualityThresholdLabel()
    );
  }

  private String normalizeStateCode(String stateCode) {
    if (stateCode == null || stateCode.isBlank()) {
      throw new BadRequestException("State code is required");
    }
    return stateCode.trim().toUpperCase();
  }
}
