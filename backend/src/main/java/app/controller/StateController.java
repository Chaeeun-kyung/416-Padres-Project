package app.controller;

import app.dto.StateSummaryResponse;
import app.service.StateService;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/states")
public class StateController {

  private final StateService stateService;

  public StateController(StateService stateService) {
    this.stateService = stateService;
  }

  @GetMapping("/{stateCode}/summary")
  public StateSummaryResponse getStateSummary(@PathVariable String stateCode) {
    return stateService.getSummary(stateCode);
  }
}
