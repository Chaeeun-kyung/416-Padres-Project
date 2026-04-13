import geopandas as gpd 
file_path = "../data/AZ-precincts-with-results.geojson" 
gdf = gpd.read_file(file_path) 
print("Loaded file successfully") 
print("Number of precincts:", len(gdf)) 
print("\nColumns:")
for col in gdf.columns:
	print(col)
