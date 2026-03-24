import geopandas as gpd 
from gerrychain import Graph 
file_path = "../data/AZ-precincts-with-results.geojson" 
gdf = gpd.read_file(file_path)
# Repair invalid geometries
gdf["geometry"] = gdf["geometry"].buffer(0)
# Optional: drop any rows that still have missing geometry
gdf = gdf[gdf.geometry.notnull()] 
graph = Graph.from_geodataframe(gdf) 
print("Graph created successfully") 
print("Nodes:", len(graph.nodes))
print("Edges:", len(graph.edges))
