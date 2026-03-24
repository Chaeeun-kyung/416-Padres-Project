package app.controller;

import app.dto.EnsembleBoxplotResponse;
import app.dto.EnsembleSplitsResponse;
import app.service.EnsembleService;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/states")
public class EnsembleController {

  private final EnsembleService ensembleService;

  public EnsembleController(EnsembleService ensembleService) {
    this.ensembleService = ensembleService;
  }

  @GetMapping("/{stateCode}/ensembles/splits")
  public EnsembleSplitsResponse getEnsembleSplits(@PathVariable String stateCode) {
    return ensembleService.getSplits(stateCode);
  }

  @GetMapping("/{stateCode}/ensembles/boxplot")
  public EnsembleBoxplotResponse getEnsembleBoxplot(
      @PathVariable String stateCode,
      @RequestParam(required = false) String group,
      @RequestParam(required = false) String ensemble
  ) {
    return ensembleService.getBoxplot(stateCode, group, ensemble);
  }
}
