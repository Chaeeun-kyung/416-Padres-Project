import geopandas as gpd 
file_path = "../data/AZ-precincts-with-results.geojson" 
gdf = gpd.read_file(file_path) 
dem_votes = gdf["votes_dem"] 
rep_votes = gdf["votes_rep"] 
dem_wins = (dem_votes > rep_votes).sum() 
rep_wins = (rep_votes > dem_votes).sum() 
print("Precinct winners:") 
print("Democratic precinct wins:", dem_wins)
print("Republican precinct wins:", rep_wins)
