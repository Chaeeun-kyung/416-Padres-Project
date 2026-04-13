package app.service;

import app.domain.DistrictRepresentationDocument;
import app.dto.DistrictRepresentationListResponse;
import app.dto.DistrictRepresentationRowResponse;
import app.exception.BadRequestException;
import app.exception.ResourceNotFoundException;
import app.repository.DistrictRepresentationRepository;
import java.util.List;
import org.springframework.cache.annotation.Cacheable;
import org.springframework.stereotype.Service;

@Service
public class RepresentationService {

  private final DistrictRepresentationRepository representationRepository;

  public RepresentationService(DistrictRepresentationRepository representationRepository) {
    this.representationRepository = representationRepository;
  }

  @Cacheable(
      cacheNames = "representation",
      key = "#rawStateCode == null ? '' : #rawStateCode.trim().toUpperCase()",
      sync = true
  )
  public DistrictRepresentationListResponse getRepresentation(String rawStateCode) {
    String stateCode = normalizeStateCode(rawStateCode);
    List<DistrictRepresentationDocument> rows = representationRepository.findByStateCode(stateCode);
    if (rows == null) {
      throw new ResourceNotFoundException("District representation not found for state " + stateCode);
    }

    List<DistrictRepresentationRowResponse> responseRows = rows.stream()
        .map(row -> new DistrictRepresentationRowResponse(
            row.districtId(),
            row.incumbent(),
            row.party(),
            row.repRaceEthnicity(),
            row.voteMarginPct()
        ))
        .toList();

    return new DistrictRepresentationListResponse(stateCode, responseRows);
  }

  private String normalizeStateCode(String stateCode) {
    if (stateCode == null || stateCode.isBlank()) {
      throw new BadRequestException("State code is required");
    }
    return stateCode.trim().toUpperCase();
  }
}
