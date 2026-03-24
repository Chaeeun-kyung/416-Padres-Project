import json 
import glob 

def compute_summary(plans):
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
    files = glob.glob("../results/recom_worker_*.json")
    all_plans = []
    for f in files:
        with open(f, "r") as file:
            data = json.load(file)
            all_plans.extend(data)
    summary = compute_summary(all_plans)
    output = {
        "summary": summary,
        "plans": all_plans
    }
    with open("../results/recom_parallel_merged.json", "w") as f:
        json.dump(output, f, indent=2)
    print("Merged {} plans".format(len(all_plans)))
    print("Saved to ../results/recom_parallel_merged.json") 
if __name__ == "__main__":
    main()
