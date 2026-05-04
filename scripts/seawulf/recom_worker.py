import argparse
import json
from pathlib import Path

from recom_driver import generate_plans


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Worker process for ReCom generation using SeaWulf input artifacts."
    )
    parser.add_argument("worker_id", type=int, help="Worker index used in output records.")
    parser.add_argument("steps", nargs="?", type=int, default=10, help="Number of attempted steps for this worker.")
    parser.add_argument("output", nargs="?", default=None, help="Optional output path override.")
    parser.add_argument("--state", default="AZ", help="Two-letter state code.")
    parser.add_argument("--input-root", default="../../results/seawulf_inputs", help="Root path for SeaWulf preprocessing outputs.")
    parser.add_argument("--seed", type=int, default=42, help="Base seed; worker id is added for divergence.")
    parser.add_argument("--pop-tolerance-pct", type=float, default=0.05, help="Population tolerance percent used by ReCom splits.")
    parser.add_argument("--vra-group-field", default=None, help="Optional CVAP group field for constrained mode.")
    parser.add_argument("--vra-min-districts", type=int, default=None, help="Minimum opportunity districts in constrained mode.")
    parser.add_argument("--vra-threshold", type=float, default=0.5, help="Opportunity threshold for constrained mode.")
    return parser.parse_args()


def main():
    args = parse_args()
    state = args.state.strip().upper()
    output_path = args.output or f"../../results/recom_worker_{state}_{args.worker_id}.json"

    # Make per-worker randomness deterministic but unique to avoid duplicate chains.
    worker_seed = int(args.seed) + int(args.worker_id)
    print(f"Worker {args.worker_id} running {args.steps} steps for state={state} (seed={worker_seed})...")

    plans = generate_plans(
        state=state,
        steps=args.steps,
        input_root=args.input_root,
        seed=worker_seed,
        pop_tolerance_pct=args.pop_tolerance_pct,
        vra_group_field=args.vra_group_field,
        vra_min_districts=args.vra_min_districts,
        vra_threshold=args.vra_threshold,
        worker_id=args.worker_id,
    )

    target = Path(output_path)
    target.parent.mkdir(parents=True, exist_ok=True)
    with target.open("w", encoding="utf-8") as handle:
        json.dump(plans, handle, indent=2)
        handle.write("\n")
    print(f"Worker {args.worker_id} saved {len(plans)} plans to {target}")


if __name__ == "__main__":
    main()
