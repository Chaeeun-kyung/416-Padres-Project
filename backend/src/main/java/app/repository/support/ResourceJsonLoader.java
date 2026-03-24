package app.repository.support;

import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.io.IOException;
import java.io.InputStream;
import java.util.HashMap;
import java.util.Map;
import org.springframework.core.io.ClassPathResource;
import org.springframework.stereotype.Component;

@Component
public class ResourceJsonLoader {

  private final ObjectMapper objectMapper;

  public ResourceJsonLoader(ObjectMapper objectMapper) {
    this.objectMapper = objectMapper;
  }

  public <T> T readResource(String resourceName, TypeReference<T> typeReference) {
    ClassPathResource resource = new ClassPathResource(resourceName);
    try (InputStream inputStream = resource.getInputStream()) {
      return objectMapper.readValue(inputStream, typeReference);
    } catch (IOException exception) {
      throw new IllegalStateException("Failed to load data from " + resourceName, exception);
    }
  }

  public <V> Map<String, V> normalizeKeys(Map<String, V> raw) {
    Map<String, V> normalized = new HashMap<>();
    for (Map.Entry<String, V> entry : raw.entrySet()) {
      normalized.put(entry.getKey().trim().toUpperCase(), entry.getValue());
    }
    return Map.copyOf(normalized);
  }
}
