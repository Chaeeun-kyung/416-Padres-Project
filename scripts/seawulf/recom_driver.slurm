#!/bin/bash 
#SBATCH --job-name=recom_driver 
#SBATCH --output=/gpfs/home/%u/cse416/results/recom_driver_%j.out 
#SBATCH --error=/gpfs/home/%u/cse416/results/recom_driver_%j.err 
#SBATCH --time=00:15:00 
#SBATCH --cpus-per-task=1 
#SBATCH --mem=2G 
#SBATCH --partition=short-28core

module purge 
module load slurm 
module load anaconda/3 
cd /gpfs/home/$USER/cse416/scripts/seawulf

# ---------------------------
# SeaWulf driver configuration
# ---------------------------
STATE=${STATE:-AZ}
STEPS=${STEPS:-100}
SEED=${SEED:-42}
INPUT_ROOT=${INPUT_ROOT:-../../results/seawulf_inputs}
OUTPUT=${OUTPUT:-../../results/recom_${STATE}_plans.json}

# Optional VRA-constrained mode:
# export VRA_GROUP_FIELD=CVAP_HSP24
# export VRA_MIN_DISTRICTS=2
# export VRA_THRESHOLD=0.50

CMD=(python3 -u recom_driver.py --state "$STATE" --steps "$STEPS" --seed "$SEED" --input-root "$INPUT_ROOT" --output "$OUTPUT")
if [ -n "$VRA_GROUP_FIELD" ] && [ -n "$VRA_MIN_DISTRICTS" ]; then
	CMD+=(--vra-group-field "$VRA_GROUP_FIELD" --vra-min-districts "$VRA_MIN_DISTRICTS" --vra-threshold "${VRA_THRESHOLD:-0.5}")
fi

echo "Running driver command: ${CMD[*]}"
"${CMD[@]}"
