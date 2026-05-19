# Running AlphaFold 3

## Installation (if not already set up)

### Provision machine (GCP example)

```bash
gcloud compute instances create alphafold3 \
  --machine-type a2-ultragpu-1g \
  --zone us-central1-a \
  --image-family ubuntu-2204-lts \
  --image-project ubuntu-os-cloud \
  --maintenance-policy TERMINATE \
  --boot-disk-size 1000 \
  --boot-disk-type pd-balanced
```

### Install Docker + GPU

```bash
# Install Docker
sudo apt-get update && sudo apt-get install -y docker-ce docker-ce-cli containerd.io

# Install NVIDIA drivers
sudo ubuntu-drivers install && sudo reboot

# Install NVIDIA container toolkit
curl -fsSL https://nvidia.github.io/libnvidia-container/gpgkey | sudo gpg --dearmor -o /usr/share/keyrings/nvidia-container-toolkit-keyring.gpg
sudo apt-get install -y nvidia-container-toolkit
nvidia-ctk runtime configure --runtime=docker --config=$HOME/.config/docker/daemon.json
```

### Build Docker container

```bash
cd alphafold3
docker build -t alphafold3 -f docker/Dockerfile .
```

For large databases, ensure `<DB_DIR>` is NOT a subdirectory of the repo (build will be slow otherwise).

### Download databases

```bash
./fetch_databases.sh <DB_DIR>
```

Downloads ~252 GB (uncompressed ~630 GB). Run in `screen`/`tmux`.

### Obtain model parameters

Request via [Google Form](https://forms.gle/svvpY4u2jsHEwWYS6). Save to `<MODEL_PARAMETERS_DIR>`, also outside the repo directory.

## Docker Run

**Remote server**: If AlphaFold3 is installed on a remote server, prefix docker commands with `ssh user@host`.

### Basic run

```bash
docker run -it \
  --volume $HOME/af_input:/root/af_input \
  --volume $HOME/af_output:/root/af_output \
  --volume <MODEL_PARAMETERS_DIR>:/root/models \
  --volume <DATABASES_DIR>:/root/public_databases \
  --gpus all \
  alphafold3 \
  python run_alphafold.py \
  --json_path=/root/af_input/fold_input.json \
  --model_dir=/root/models \
  --output_dir=/root/af_output
```

### SSD fallback (SSD + slower disk)

```bash
docker run -it \
  --volume $HOME/af_input:/root/af_input \
  --volume $HOME/af_output:/root/af_output \
  --volume <MODEL_PARAMETERS_DIR>:/root/models \
  --volume <SSD_DB_DIR>:/root/public_databases \
  --volume <HDD_DB_DIR>:/root/public_databases_fallback \
  --gpus all \
  alphafold3 \
  python run_alphafold.py \
  --json_path=/root/af_input/fold_input.json \
  --model_dir=/root/models \
  --db_dir=/root/public_databases \
  --db_dir=/root/public_databases_fallback \
  --output_dir=/root/af_output
```

### Multiple inputs

```bash
docker run ... alphafold3 python run_alphafold.py \
  --input_dir=/root/af_input \
  --model_dir=/root/models \
  --output_dir=/root/af_output
```

## Singularity Run

```bash
# Build Singularity image from Docker
singularity build alphafold3.sif docker://alphafold3:latest

# Run
singularity exec --nv \
  --bind $HOME/af_input:/root/af_input \
  --bind $HOME/af_output:/root/af_output \
  --bind <MODEL_PARAMETERS_DIR>:/root/models \
  --bind <DATABASES_DIR>:/root/public_databases \
  alphafold3.sif \
  python run_alphafold.py \
  --json_path=/root/af_input/fold_input.json \
  --model_dir=/root/models \
  --output_dir=/root/af_output
```

## Key Flags

| Flag | Default | Description |
|------|---------|-------------|
| `--json_path` | — | Path to single input JSON |
| `--input_dir` | — | Directory of input JSONs (batch) |
| `--output_dir` | — | Output directory |
| `--model_dir` | — | Model parameters directory |
| `--db_dir` | — | Database directory (can specify multiple) |
| `--run_data_pipeline` | `true` | Run genetic/template search (CPU) |
| `--run_inference` | `true` | Run featurization + model inference (GPU) |
| `--conformer_max_iterations` | — | Increase if RDKit fails to generate conformer |
| `--jax_compilation_cache_dir` | — | JAX persistent compilation cache path |
| `--force_output_dir` | `false` | Overwrite existing output directory |
| `--save_embeddings` | `false` | Save single/pair embeddings |
| `--save_distogram` | `false` | Save distogram (can be ~3 GiB) |
| `--buckets` | — | Comma-separated bucket sizes for compilation |
| `--jackhmmer_n_cpu` | — | CPUs per Jackhmmer process |
| `--nhmmer_n_cpu` | — | CPUs per Nhmmer process |
| `--max_template_date` | — | Max template release date (YYYY-MM-DD) |

Run `python run_alphafold.py --help` for the full list.

## Staged Pipeline

### Data pipeline only (no GPU needed)

```bash
python run_alphafold.py \
  --json_path=... \
  --model_dir=... \
  --db_dir=... \
  --output_dir=... \
  --run_inference=false
```

Outputs JSON with MSA + templates pre-computed. Useful for:
- Running on a CPU machine, then transferring to GPU machine
- Reusing MSA across seeds or ligand variants
- Pre-computing MSA for fixed chains in combinatorial screens

### Inference only (skip data pipeline)

```bash
python run_alphafold.py \
  --json_path=<precomputed_data.json> \
  --model_dir=... \
  --output_dir=... \
  --run_data_pipeline=false
```

Input JSON must already contain MSA/template data (from data pipeline run).

### Reuse MSA for combinatorial chain pairs

1. Run data pipeline for each monomer chain A, B, C, D with `--run_inference=false`
2. Build dimer JSONs by merging monomers (copy `unpairedMsa`, `pairedMsa`, `templates` from pre-computed JSONs)
3. Run inference on all dimers with `--run_data_pipeline=false`
4. Result: *n* + *m* data pipeline runs instead of *n* × *m*

## Performance

### Compilation buckets

Avoid re-compilation for similar input sizes:

```bash
python run_alphafold.py \
  --buckets 256,512,768,1024,1280,1536,2048,2560,3072,3584,4096,4608,5120,5376 ...
```

Always compile for the largest bucket you expect, and smaller inputs will be padded. If inputs vary widely, add all intermediate bucket sizes to avoid recompilation.

### Sharded genetic databases

For machines with many CPU cores and fast SSD/RAM-backed storage.

Split each database FASTA into shards (e.g., 16 for BFD, 512 for MGnify):

```bash
seqkit shuffle --two-pass <db.fasta> | seqkit split2 --by-part <N> --out-dir <shards_dir>
```

Name format: `prefix-00000-of-NNNNN`

```bash
python run_alphafold.py \
  --small_bfd_database_path="bfd-first_non_consensus_sequences.fasta@64" \
  --small_bfd_z_value=65984053 \
  --mgnify_database_path="mgy_clusters_2022_05.fa@512" \
  --mgnify_z_value=623796864 \
  --jackhmmer_n_cpu=2 \
  --jackhmmer_max_parallel_shards=16 \
  --nhmmer_n_cpu=2 \
  --nhmmer_max_parallel_shards=16
```

Can achieve 10–30× speedup on the genetic search stage.

### GPU memory

Default (A100 80 GB / H100 80 GB, up to 5120 tokens):
```
XLA_PYTHON_CLIENT_PREALLOCATE=true
XLA_CLIENT_MEM_FRACTION=0.95
```

Unified memory for >5120 tokens or A100 40 GB:
```
XLA_PYTHON_CLIENT_PREALLOCATE=false
TF_FORCE_UNIFIED_MEMORY=true
XLA_CLIENT_MEM_FRACTION=3.2
```

A100 40 GB with unified memory: up to ~4352 tokens (requires `pair_transition_shard_spec` adjustment).

### JAX compilation cache

```bash
python run_alphafold.py \
  --jax_compilation_cache_dir /path/to/cache ...
```

Avoids recompilation between runs. For GCS cache, install `etils`.

### XLA flags (set in Dockerfile by default)

```dockerfile
ENV XLA_FLAGS="--xla_gpu_enable_triton_gemm=false"
```

For V100 (CUDA Capability 7.x):
```dockerfile
ENV XLA_FLAGS="--xla_disable_hlo_passes=custom-kernel-fusion-rewriter"
```
