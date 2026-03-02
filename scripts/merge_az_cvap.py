#!/usr/bin/env python3
import geopandas as gpd
import pandas as pd


def main() -> None:
    prec_path = "public/geojson/AZ-precincts-with-results.geojson"
    block_path = "az_pl2020_b/az_pl2020_p4_b.shp"
    cvap_path = "az_cvap_2024_2020_b_csv/az_cvap_2024_2020_b.csv"
    out_path = "public/geojson/AZ-precincts-with-results-cvap.geojson"

    # Load inputs
    precincts = gpd.read_file(prec_path)
    blocks = gpd.read_file(block_path)
    cvap = pd.read_csv(cvap_path, dtype={"GEOID20": str})

    # Keep only needed columns
    cvap_cols = ["GEOID20", "CVAP_TOT24", "CVAP_HSP24", "CVAP_BLA24", "CVAP_ASI24", "CVAP_WHT24"]
    cvap = cvap[cvap_cols].copy()
    for col in cvap_cols[1:]:
        cvap[col] = pd.to_numeric(cvap[col], errors="coerce")
        cvap.loc[cvap[col] == -999999, col] = pd.NA

    # Attach CVAP attributes to block geometry
    blocks["GEOID20"] = blocks["GEOID20"].astype(str)
    blocks = blocks.merge(cvap, on="GEOID20", how="inner")

    # Reproject for area-weighted interpolation
    precincts_area = precincts[["GEOID", "geometry"]].to_crs(5070)
    blocks_area = blocks[["GEOID20", "geometry", "CVAP_TOT24", "CVAP_HSP24", "CVAP_BLA24", "CVAP_ASI24", "CVAP_WHT24"]].to_crs(5070)
    blocks_area["src_area"] = blocks_area.geometry.area

    # Spatial overlay and weighting
    ix = gpd.overlay(
        precincts_area,
        blocks_area[["GEOID20", "src_area", "geometry", "CVAP_TOT24", "CVAP_HSP24", "CVAP_BLA24", "CVAP_ASI24", "CVAP_WHT24"]],
        how="intersection",
        keep_geom_type=False,
    )
    ix = ix[ix.geometry.geom_type.isin(["Polygon", "MultiPolygon"])].copy()
    ix["w"] = ix.geometry.area / ix["src_area"]

    for col in ["CVAP_TOT24", "CVAP_HSP24", "CVAP_BLA24", "CVAP_ASI24", "CVAP_WHT24"]:
        ix[col] = ix[col] * ix["w"]

    # Aggregate to precinct level
    agg = ix.groupby("GEOID", as_index=False)[["CVAP_TOT24", "CVAP_HSP24", "CVAP_BLA24", "CVAP_ASI24", "CVAP_WHT24"]].sum()

    # Join back and compute percentages
    out = precincts.merge(agg, on="GEOID", how="left")
    out["PCT_CVAP_HSP"] = (out["CVAP_HSP24"] / out["CVAP_TOT24"]).clip(lower=0, upper=1)
    out["PCT_CVAP_BLA"] = (out["CVAP_BLA24"] / out["CVAP_TOT24"]).clip(lower=0, upper=1)
    out["PCT_CVAP_ASI"] = (out["CVAP_ASI24"] / out["CVAP_TOT24"]).clip(lower=0, upper=1)
    out["PCT_CVAP_WHT"] = (out["CVAP_WHT24"] / out["CVAP_TOT24"]).clip(lower=0, upper=1)

    # Quick checks
    for col in ["CVAP_HSP24", "CVAP_BLA24", "CVAP_ASI24", "CVAP_WHT24"]:
        bad = int((out[col] > out["CVAP_TOT24"]).sum())
        print(f"rows where {col} > CVAP_TOT24:", bad)
    print("precinct rows:", len(out))
    print("missing CVAP total:", int(out["CVAP_TOT24"].isna().sum()))
    print("sum CVAP total:", float(out["CVAP_TOT24"].sum(skipna=True)))

    # Write merged file
    out.to_file(out_path, driver="GeoJSON")
    print("wrote:", out_path)


if __name__ == "__main__":
    main()