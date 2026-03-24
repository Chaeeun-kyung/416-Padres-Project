import json 
import random 
import sys 

from recom_test import create_test_graph, one_recom_step, district_populations 
from recom_driver import (
    add_fake_votes,
    compute_district_winners,
    compute_plan_split,
    export_plan, 
) 

def main():
    random.seed(42)
    # -------- PARAMETERS --------
    worker_id = int(sys.argv[1])
    num_steps = int(sys.argv[2]) if len(sys.argv) > 2 else 10
    output_file = "../results/recom_worker_{}.json".format(worker_id)
    print("Worker {} running {} steps...".format(worker_id, num_steps))
    # -------- GRAPH --------
    G = create_test_graph(rows=4, cols=4, num_districts=4, pop=100)
    add_fake_votes(G)
    plans = []
    # -------- GENERATE --------
    for step in range(num_steps):
        success = one_recom_step(G, tolerance=100)
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
    # -------- SAVE --------
    with open(output_file, "w") as f:
        json.dump(plans, f, indent=2)
    print("Worker {} saved to {}".format(worker_id, output_file)) 

if __name__ == "__main__":
    main()
