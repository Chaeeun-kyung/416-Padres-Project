#!/bin/bash 
#SBATCH --job-name=state_summary 
#SBATCH --output=/gpfs/home/%u/cse416/results/state_summary_%j.out 
#SBATCH --error=/gpfs/home/%u/cse416/results/state_summary_%j.err 
#SBATCH --time=00:15:00 
#SBATCH --cpus-per-task=1 
#SBATCH --mem=2G 
#SBATCH --partition=short-28core

module purge 
module load slurm 
module load anaconda/3 
source activate cse416 
cd /gpfs/home/$USER/cse416/scripts
python -u state_summary.py
