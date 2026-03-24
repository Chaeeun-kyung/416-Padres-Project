package app;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.web.servlet.MockMvc;

@SpringBootTest
@AutoConfigureMockMvc
class ApiIntegrationTest {

  @Autowired
  private MockMvc mockMvc;

  @Test
  void stateSummaryReturnsFullDashboardShape() throws Exception {
    mockMvc.perform(get("/api/states/CO/summary"))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.stateCode").value("CO"))
        .andExpect(jsonPath("$.districts").value(8))
        .andExpect(jsonPath("$.votingAgePopulation").exists())
        .andExpect(jsonPath("$.voterDistribution.demVotes").value(1727561))
        .andExpect(jsonPath("$.voterDistribution.demPct").exists())
        .andExpect(jsonPath("$.ensembleSummary.raceBlindPlans").exists())
        .andExpect(jsonPath("$.congressionalPartySummary.democrats").exists());
  }

  @Test
  void ensembleSplitsIncludesDistrictCount() throws Exception {
    mockMvc.perform(get("/api/states/AZ/ensembles/splits"))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.stateCode").value("AZ"))
        .andExpect(jsonPath("$.districtCount").value(9))
        .andExpect(jsonPath("$.raceBlind").isArray())
        .andExpect(jsonPath("$.vraConstrained").isArray());
  }

  @Test
  void ensembleBoxplotReturnsBackendOwnedVariant() throws Exception {
    mockMvc.perform(get("/api/states/CO/ensembles/boxplot")
            .param("group", "latino_pct")
            .param("ensemble", "vraConstrained"))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.stateCode").value("CO"))
        .andExpect(jsonPath("$.groupKey").value("latino_pct"))
        .andExpect(jsonPath("$.ensembleKey").value("vraConstrained"))
        .andExpect(jsonPath("$.availableGroups").isArray())
        .andExpect(jsonPath("$.availableEnsembles").isArray())
        .andExpect(jsonPath("$.districtOrder").isArray())
        .andExpect(jsonPath("$.distributions").isMap())
        .andExpect(jsonPath("$.enacted").isMap());
  }

  @Test
  void ginglesReturnsPrecomputedTrendAndCoefficients() throws Exception {
    mockMvc.perform(get("/api/states/AZ/analysis/gingles").param("group", "latino_pct"))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.stateCode").value("AZ"))
        .andExpect(jsonPath("$.groupKey").value("latino_pct"))
        .andExpect(jsonPath("$.trendRows").isArray())
        .andExpect(jsonPath("$.trendRows.length()").value(90))
        .andExpect(jsonPath("$.demCoefficients").isArray())
        .andExpect(jsonPath("$.repCoefficients").isArray())
        .andExpect(jsonPath("$.renderPointCount").value(1000));
  }

  @Test
  void invalidBoxplotGroupReturnsBadRequest() throws Exception {
    mockMvc.perform(get("/api/states/AZ/ensembles/boxplot").param("group", "bad_group"))
        .andExpect(status().isBadRequest())
        .andExpect(jsonPath("$.message").value("Unsupported ensemble boxplot group: bad_group"));
  }
}
