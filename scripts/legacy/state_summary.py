import warnings 
import geopandas as gpd 
import networkx as nx
from gerrychain import Graph 
warnings.filterwarnings("ignore") 
files = {
    "Arizona": "../data/AZ-precincts-with-results.geojson",
    "Colorado": "../data/CO-precincts-with-results.geojson",
}
for state_name, file_path in files.items():
    gdf = gpd.read_file(file_path)
    total_dem = gdf["votes_dem"].sum()
    total_rep = gdf["votes_rep"].sum()
    total_votes = gdf["votes_total"].sum()
    dem_precinct_wins = (gdf["votes_dem"] > gdf["votes_rep"]).sum()
    rep_precinct_wins = (gdf["votes_rep"] > gdf["votes_dem"]).sum()
    repaired = gdf.copy()
    repaired["geometry"] = repaired["geometry"].buffer(0)
    repaired = repaired[repaired.geometry.notnull()]
    graph = Graph.from_geodataframe(repaired, ignore_errors=True)
    components = list(nx.connected_components(graph))
    print(f"\n{state_name}", flush=True)
    print("=" * len(state_name), flush=True)
    print("Precincts:", len(gdf), flush=True)
    print("Dem votes:", total_dem, flush=True)
    print("Rep votes:", total_rep, flush=True)
    print("Total votes:", total_votes, flush=True)
    print("Dem share:", total_dem / total_votes if total_votes else 0, flush=True)
    print("Rep share:", total_rep / total_votes if total_votes else 0, flush=True)
    print("Dem precinct wins:", dem_precinct_wins, flush=True)
    print("Rep precinct wins:", rep_precinct_wins, flush=True)
    print("Graph nodes:", len(graph.nodes), flush=True)
    print("Graph edges:", len(graph.edges), flush=True)
    print("Connected components:", len(components), flush=True)
    print("Largest component:", max(len(c) for c in components), flush=True)
