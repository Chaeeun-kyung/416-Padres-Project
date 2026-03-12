package app;

import java.util.Map;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/states")
public class StateSummaryController {

  private final StateSummaryService stateSummaryService;

  public StateSummaryController(StateSummaryService stateSummaryService) {
    this.stateSummaryService = stateSummaryService;
  }

  @GetMapping("/{stateCode}/summary")
  public ResponseEntity<?> getStateSummary(@PathVariable String stateCode) {
    // The controller only handles the HTTP request/response shape.
    StateSummaryResponse summary = stateSummaryService.findByStateCode(stateCode);
    if (summary == null) {
      return ResponseEntity.status(HttpStatus.NOT_FOUND).body(
          Map.of(
              "error", "State summary not found",
              "stateCode", stateCode
          )
      );
    }

    // Spring serializes this record to JSON automatically.
    return ResponseEntity.ok(summary);
  }
}
