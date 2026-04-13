import json
import random
import sys

from recom_test import one_recom_step, district_populations
from build_graph import build_real_graph


def export_plan(G):
    """
    Export district assignment for each node.
    """
    return {str(node): G.nodes[node]["district"] for node in G.nodes()}


def compute_district_winners(G):
    """
    Compute winner (D or R) for each district using real vote totals.
    """
    totals = {}

    for n in G.nodes():
        d = G.nodes[n]["district"]

        if d not in totals:
            totals[d] = {"D": 0, "R": 0}

        totals[d]["D"] += G.nodes[n]["dem_votes"]
        totals[d]["R"] += G.nodes[n]["rep_votes"]

    winners = {}
    for d in totals:
        if totals[d]["D"] > totals[d]["R"]:
            winners[d] = "D"
        else:
            winners[d] = "R"

    return winners


def compute_plan_split(winners):
    """
    Count how many districts are won by Republicans vs Democrats.
    """
    r = sum(1 for w in winners.values() if w == "R")
    d = sum(1 for w in winners.values() if w == "D")
    return {"R": r, "D": d}


def compute_ensemble_summary(plans):
    """
    Compute simple ensemble summary statistics.
    """
    if not plans:
        return {}

    r_vals = [p["split"]["R"] for p in plans]
    d_vals = [p["split"]["D"] for p in plans]

    return {
        "num_plans": len(plans),
        "avg_R": sum(r_vals) / float(len(r_vals)),
        "avg_D": sum(d_vals) / float(len(d_vals)),
        "min_R": min(r_vals),
        "max_R": max(r_vals),
        "min_D": min(d_vals),
        "max_D": max(d_vals),
    }


def main():
    random.seed(42)

    num_steps = int(sys.argv[1]) if len(sys.argv) > 1 else 10
    output_file = sys.argv[2] if len(sys.argv) > 2 else "../results/recom_real_az.json"

    print("Running {} ReCom steps on real AZ graph...".format(num_steps))

    G = build_real_graph("../data/AZ-precincts-with-results.geojson")

    plans = []

    for step in range(num_steps):
        success = one_recom_step(G, tolerance=5000)

        if not success:
            print("Step {} failed".format(step + 1))
            continue

        winners = compute_district_winners(G)
        split = compute_plan_split(winners)

        record = {
            "step": step + 1,
            "district_populations": district_populations(G),
            "winners": winners,
            "split": split,
            "assignment": export_plan(G),
        }

        plans.append(record)
        print("Step {} saved | Split: {}".format(step + 1, split))

    summary = compute_ensemble_summary(plans)

    print("\nEnsemble Summary:")
    print(summary)

    output = {
        "graph": "AZ real precinct graph",
        "num_plans": len(plans),
        "summary": summary,
        "plans": plans,
    }

    with open(output_file, "w") as f:
        json.dump(output, f, indent=2)

    print("\nSaved to {}".format(output_file))


if __name__ == "__main__":
    main()
