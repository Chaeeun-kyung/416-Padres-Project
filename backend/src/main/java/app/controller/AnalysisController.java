package app.controller;

import app.dto.EiResponse;
import app.dto.GinglesResponse;
import app.service.AnalysisService;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/states")
public class AnalysisController {

  private final AnalysisService analysisService;

  public AnalysisController(AnalysisService analysisService) {
    this.analysisService = analysisService;
  }

  @GetMapping("/{stateCode}/analysis/gingles")
  public GinglesResponse getGinglesAnalysis(
      @PathVariable String stateCode,
      @RequestParam(required = false) String group
  ) {
    return analysisService.getGingles(stateCode, group);
  }

  @GetMapping("/{stateCode}/analysis/ei")
  public EiResponse getEiAnalysis(
      @PathVariable String stateCode,
      @RequestParam(required = false) String group
  ) {
    return analysisService.getEi(stateCode, group);
  }
}
