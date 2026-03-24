import geopandas as gpd 
import networkx as nx 
from gerrychain import Graph 
file_path = "../data/AZ-precincts-with-results.geojson" 
gdf = gpd.read_file(file_path) 
gdf["geometry"] = gdf["geometry"].buffer(0) 
gdf = gdf[gdf.geometry.notnull()] 
graph = Graph.from_geodataframe(gdf, ignore_errors=True) 
print("Graph statistics") 
print("Nodes:", len(graph.nodes)) 
print("Edges:", len(graph.edges))  
components = list(nx.connected_components(graph)) 
print("Connected components:", len(components))
print("Largest component size:", max(len(c) for c in components))
