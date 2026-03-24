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
TOTAL=100 
WORKERS=4 
BASE=$((TOTAL / WORKERS)) 
REM=$((TOTAL % WORKERS)) 

echo "Total plans: $TOTAL" 
echo "Workers: $WORKERS"
# -------- DISTRIBUTION -------- First REM workers get 
# BASE+1, others get BASE
for i in $(seq 0 $((WORKERS-1))) do
    if [ $i -lt $REM ]; then
        COUNT=$((BASE+1))
    else
        COUNT=$BASE
    fi
    echo "Worker $i generating $COUNT plans"
    python recom_worker.py $i $COUNT ../results/recom_worker_${i}.json & done 
wait 
echo "All workers finished"
# -------- MERGE --------
python merge_parallel_results.py
echo "Parallel job complete"
