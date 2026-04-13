import geopandas as gpd
from gerrychain import Graph


def build_real_graph(file_path, num_districts=4, pop_value=100):
    """
    Build a real precinct adjacency graph from a GeoJSON file.

    Each node gets:
    - population (temporary for now)
    - dem_votes
    - rep_votes
    - votes_total
    - district (temporary geographic assignment)
    """
    # -------- LOAD DATA --------
    gdf = gpd.read_file(file_path)

    # fix invalid geometries
    gdf["geometry"] = gdf["geometry"].buffer(0)
    gdf = gdf[gdf.geometry.notnull()].copy()

    # use GEOID as node id
    gdf = gdf.set_index("GEOID", drop=False)

    # -------- BUILD ADJACENCY GRAPH --------
    graph = Graph.from_geodataframe(gdf)

    print("Graph created successfully")
    print("Nodes:", len(graph.nodes))
    print("Edges:", len(graph.edges))

    # -------- ADD ATTRIBUTES --------
    for node in graph.nodes:
        row = gdf.loc[node]

        graph.nodes[node]["population"] = pop_value   # temporary
        graph.nodes[node]["dem_votes"] = row["votes_dem"]
        graph.nodes[node]["rep_votes"] = row["votes_rep"]
        graph.nodes[node]["votes_total"] = row["votes_total"]

    # -------- ADD TEMPORARY GEOGRAPHIC DISTRICTS --------
    # Use centroid x-coordinate (longitude) to create contiguous-ish regions.
    # This is much better than assigning by sorted GEOID.
    gdf["centroid_x"] = gdf.geometry.centroid.x

    sorted_nodes = list(gdf.sort_values("centroid_x").index)
    chunk_size = max(1, len(sorted_nodes) // num_districts)

    for i, node in enumerate(sorted_nodes):
        district = min(i // chunk_size, num_districts - 1)
        graph.nodes[node]["district"] = district

    print("Attributes added (population, votes, district)")
    return graph


if __name__ == "__main__":
    G = build_real_graph("../data/AZ-precincts-with-results.geojson")

    print("\nSample nodes:")
    for n in list(G.nodes)[:5]:
        print(n, G.nodes[n])

    # show rough district counts
    district_counts = {}
    for n in G.nodes:
        d = G.nodes[n]["district"]
        district_counts[d] = district_counts.get(d, 0) + 1

    print("\nTemporary district sizes:")
    for d in sorted(district_counts):
        print("District {}: {} precincts".format(d, district_counts[d]))
