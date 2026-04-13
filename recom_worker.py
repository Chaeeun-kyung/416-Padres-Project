import json
import random
import sys

from recom_test import one_recom_step, district_populations
from build_graph import build_real_graph


def export_plan(G):
    return {str(node): G.nodes[node]["district"] for node in G.nodes()}


def compute_district_winners(G):
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
    r = sum(1 for w in winners.values() if w == "R")
    d = sum(1 for w in winners.values() if w == "D")
    return {"R": r, "D": d}


def main():
    random.seed(42)

    worker_id = int(sys.argv[1])
    num_steps = int(sys.argv[2])
    output_file = sys.argv[3]

    print("Worker {} running {} steps on real AZ graph".format(worker_id, num_steps))

    G = build_real_graph("../data/AZ-precincts-with-results.geojson")

    plans = []

    for step in range(num_steps):
        success = one_recom_step(G, tolerance=5000)

        if not success:
            print("Worker {} step {} failed".format(worker_id, step + 1))
            continue

        winners = compute_district_winners(G)
        split = compute_plan_split(winners)

        record = {
            "worker": worker_id,
            "step": step + 1,
            "district_populations": district_populations(G),
            "winners": winners,
            "split": split,
            "assignment": export_plan(G),
        }

        plans.append(record)
        print("Worker {} step {} saved".format(worker_id, step + 1))

    with open(output_file, "w") as f:
        json.dump(plans, f, indent=2)

    print("Worker {} saved to {}".format(worker_id, output_file))


if __name__ == "__main__":
    main()
