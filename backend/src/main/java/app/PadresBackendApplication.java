package app;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.cache.annotation.EnableCaching;

@SpringBootApplication
@EnableCaching
public class PadresBackendApplication {

  public static void main(String[] args) {
    // Start Spring Boot and the embedded web server.
    SpringApplication.run(PadresBackendApplication.class, args);
  }
}
