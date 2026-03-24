package app;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;

@SpringBootApplication
public class PadresBackendApplication {

  public static void main(String[] args) {
    // Start Spring Boot and the embedded web server.
    SpringApplication.run(PadresBackendApplication.class, args);
  }
}
