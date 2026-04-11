#!/bin/bash 
#SBATCH --job-name=recom_parallel 
#SBATCH --output=/gpfs/home/%u/cse416/results/recom_parallel_%j.out 
#SBATCH --error=/gpfs/home/%u/cse416/results/recom_parallel_%j.err 
#SBATCH --time=00:15:00 
#SBATCH --cpus-per-task=4 
#SBATCH --mem=4G 
#SBATCH --partition=short-28core

module purge 
module load slurm 
module load anaconda/3 
source activate cse416 

cd /gpfs/home/$USER/cse416/scripts
# -------- PARAMETERS --------
STATE=${STATE:-AZ}
TOTAL=${TOTAL:-100}
WORKERS=${WORKERS:-4}
SEED=${SEED:-42}
INPUT_ROOT=${INPUT_ROOT:-../results/seawulf_inputs}
MERGED_OUTPUT=${MERGED_OUTPUT:-../results/recom_parallel_merged_${STATE}.json}

BASE=$((TOTAL / WORKERS)) 
REM=$((TOTAL % WORKERS)) 

echo "Total plans: $TOTAL" 
echo "Workers: $WORKERS"
echo "State: $STATE"
# -------- DISTRIBUTION -------- First REM workers get 
# BASE+1, others get BASE
for i in $(seq 0 $((WORKERS-1))) do
    if [ $i -lt $REM ]; then
        COUNT=$((BASE+1))
    else
        COUNT=$BASE
    fi
    echo "Worker $i generating $COUNT plans"
        OUT="../results/recom_worker_${STATE}_${i}.json"
        CMD=(python recom_worker.py "$i" "$COUNT" "$OUT" --state "$STATE" --seed "$SEED" --input-root "$INPUT_ROOT")
        if [ -n "$VRA_GROUP_FIELD" ] && [ -n "$VRA_MIN_DISTRICTS" ]; then
            CMD+=(--vra-group-field "$VRA_GROUP_FIELD" --vra-min-districts "$VRA_MIN_DISTRICTS" --vra-threshold "${VRA_THRESHOLD:-0.5}")
        fi
        "${CMD[@]}" &
done 
wait 
echo "All workers finished"
# -------- MERGE --------
python merge_parallel_results.py --state "$STATE" --pattern "../results/recom_worker_${STATE}_*.json" --output "$MERGED_OUTPUT"
echo "Parallel job complete"
