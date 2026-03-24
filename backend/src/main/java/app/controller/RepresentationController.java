package app.controller;

import app.dto.DistrictRepresentationListResponse;
import app.service.RepresentationService;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/states")
public class RepresentationController {

  private final RepresentationService representationService;

  public RepresentationController(RepresentationService representationService) {
    this.representationService = representationService;
  }

  @GetMapping("/{stateCode}/representation")
  public DistrictRepresentationListResponse getRepresentation(@PathVariable String stateCode) {
    return representationService.getRepresentation(stateCode);
  }
}
