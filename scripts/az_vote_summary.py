import geopandas as gpd 
file_path = "../data/AZ-precincts-with-results.geojson" 
gdf = gpd.read_file(file_path) 
total_dem = gdf["votes_dem"].sum() 
total_rep = gdf["votes_rep"].sum() 
total_votes = gdf["votes_total"].sum() 
print("Arizona precinct vote summary") 
print("Democratic votes:", total_dem) 
print("Republican votes:", total_rep) 
print("Total votes:", total_votes) 
if total_votes > 0:
    print("Democratic share:", total_dem / total_votes)
    print("Republican share:", total_rep / total_votes)
