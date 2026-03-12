package app;

import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.io.IOException;
import java.io.InputStream;
import java.util.HashMap;
import java.util.Map;
import org.springframework.core.io.ClassPathResource;
import org.springframework.stereotype.Service;

@Service
public class StateSummaryService {
  private static final String STATE_SUMMARY_FILE = "state-summary.json";

  private final Map<String, StateSummaryResponse> summariesByStateCode;

  public StateSummaryService(ObjectMapper objectMapper) {
    // Load the small review dataset once at startup and keep it in memory.
    this.summariesByStateCode = loadSummaryByStateCode(objectMapper);
  }

  public StateSummaryResponse findByStateCode(String stateCode) {
    if (stateCode == null || stateCode.isBlank()) {
      return null;
    }

    String normalizedCode = stateCode.trim().toUpperCase();
    return summariesByStateCode.get(normalizedCode);
  }

  private Map<String, StateSummaryResponse> loadSummaryByStateCode(ObjectMapper objectMapper) {
    ClassPathResource resource = new ClassPathResource(STATE_SUMMARY_FILE);
    try (InputStream inputStream = resource.getInputStream()) {
      // Read {"AZ": {...}, "CO": {...}} into a Java map.
      TypeReference<Map<String, StateSummaryResponse>> type = new TypeReference<>() {};
      Map<String, StateSummaryResponse> rawMap = objectMapper.readValue(inputStream, type);
      Map<String, StateSummaryResponse> normalizedMap = new HashMap<>();
      for (Map.Entry<String, StateSummaryResponse> entry : rawMap.entrySet()) {
        // Normalize keys so "az" and "AZ" resolve the same way.
        normalizedMap.put(entry.getKey().toUpperCase(), entry.getValue());
      }
      return Map.copyOf(normalizedMap);
    } catch (IOException exception) {
      throw new IllegalStateException("Failed to load state summary data from " + STATE_SUMMARY_FILE, exception);
    }
  }
}
