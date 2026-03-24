import geopandas as gpd 
file_path = "../data/AZ-precincts-with-results.geojson" 
gdf = gpd.read_file(file_path) 
print("official_boundary sample values:") 
print(gdf["official_boundary"].head(20)) 
print("\nUnique district values:") 
print(sorted(gdf["official_boundary"].dropna().unique()))
print("Number of unique values:", gdf["official_boundary"].nunique())
