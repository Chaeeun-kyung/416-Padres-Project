import argparse
import glob
import json
from pathlib import Path


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Merge per-worker ReCom outputs into one ensemble file.")
    parser.add_argument("--state", default=None, help="Optional state filter (AZ/CO).")
    parser.add_argument(
        "--pattern",
        default="../../results/recom_worker_*.json",
        help="Glob pattern for worker output files.",
    )
    parser.add_argument(
        "--output",
        default="../../results/recom_parallel_merged.json",
        help="Merged output file path.",
    )
    return parser.parse_args()


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
    args = parse_args()
    files = sorted(glob.glob(args.pattern))
    all_plans = []
    for file_path in files:
        with open(file_path, "r", encoding="utf-8") as handle:
            data = json.load(handle)
            if isinstance(data, list):
                all_plans.extend(data)

    if args.state:
        state_upper = args.state.strip().upper()
        all_plans = [p for p in all_plans if str(p.get("state", "")).upper() == state_upper]
    else:
        state_upper = None

    summary = compute_summary(all_plans)
    output = {
        "state": state_upper,
        "summary": summary,
        "plans": all_plans,
        "source_files": files,
    }

    output_path = Path(args.output)
    output_path.parent.mkdir(parents=True, exist_ok=True)
    with output_path.open("w", encoding="utf-8") as handle:
        json.dump(output, handle, indent=2)
        handle.write("\n")
    print("Merged {} plans".format(len(all_plans)))
    print("Saved to {}".format(output_path))


if __name__ == "__main__":
    main()
