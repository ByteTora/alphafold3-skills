---
name: alphafold3
description: "Run and interpret AlphaFold 3 — Google DeepMind's biomolecular structure prediction pipeline. Use when the user wants to: run AlphaFold 3 inference (Docker/Singularity), create or modify input JSON files, build multi-chain protein/RNA/DNA/ligand complexes, interpret confidence metrics (pLDDT/PAE/pTM/ipTM), troubleshoot folding failures, optimize performance, understand model architecture or data pipeline internals, navigate the source code, set up development environment, or convert FASTA/SDF to AF3 input. Triggers on mentions of AlphaFold3, AF3, Google DeepMind alphafold3, fold a protein."
---

# AlphaFold 3

Run, analyze, and debug Google DeepMind's [AlphaFold 3](https://github.com/google-deepmind/alphafold3) inference pipeline.

## Prerequisites

> **Important**: AlphaFold 3 must be **fully installed** on the target machine before using this skill. This includes cloning the repository, building the Docker image, downloading sequence alignment databases, and obtaining model parameters. The skill guides you through inference — it does not install AlphaFold 3.

These are assumed to be in place (the user configured their environment):

- **Repo cloned**: `git clone https://github.com/google-deepmind/alphafold3.git`
- **Docker image built**: `docker build -t alphafold3 -f docker/Dockerfile .`
- **Sequence alignment databases downloaded** (~252 GB download, ~630 GB decompressed): `./fetch_databases.sh <DB_DIR>`
- **Model parameters obtained**: via [Google form](https://forms.gle/svvpY4u2jsHEwWYS6), saved to `<MODEL_PARAMETERS_DIR>`
- **Linux host** with NVIDIA GPU (A100 80 GB or H100 80 GB recommended, Compute Capability >= 8.0)

If any are missing, see `references/running.md` → Installation section for setup instructions.

## Quick Start

If AlphaFold3 is installed on a **remote server**, use the **remote-server** skill for SSH connection, file transfer, and background job management. Then run:

```bash
ssh user@host "docker run -it --gpus all ..."
```

If running locally:

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

## Input JSON

The top-level input structure:

```json
{
  "name": "my_job",
  "modelSeeds": [1, 2],
  "sequences": [
    {"protein": {"id": "A", "sequence": "PVLSCGEWQL", ...}},
    {"rna": {"id": "B", "sequence": "AGCU", ...}},
    {"dna": {"id": "C", "sequence": "GACCTCT", ...}},
    {"ligand": {"id": "D", "ccdCodes": ["ATP"]}},
    {"ligand": {"id": "E", "smiles": "CC(=O)OC1C[NH+]2CCC1CC2"}}
  ],
  "bondedAtomPairs": [[["A", 145, "SG"], ["D", 1, "C04"]]],
  "userCCD": "...",
  "dialect": "alphafold3",
  "version": 4
}
```

For full details on every entity type, modifications, MSA, templates, bonds, CCD, and version differences, see `references/input-format.md`.

### Companion Tool: af3cli

If the user needs help building the input JSON, use the **af3cli** skill — it provides a CLI and Python library for generating AF3 input files from sequences, FASTA, SDF, SMILES, and CCD.

## Running Inference

See `references/running.md` for full details on:

- **Basic docker run** with all volume mounts
- **Singularity** alternative
- **SSD fallback** — mount SSD + slower disk
- **Key flags**: `--run_data_pipeline`, `--run_inference`, `--conformer_max_iterations`, `--jax_compilation_cache_dir`, `--force_output_dir`, `--buckets`, `--save_embeddings`, `--save_distogram`
- **Staged pipeline**: data-pipeline-only (`--run_inference=false`), inference-only (`--run_data_pipeline=false`), MSA reuse across runs
- **Multiple inputs**: use `--input_dir` for batch processing
- **Performance**: compilation buckets, sharded databases, unified memory, JAX compilation cache

## Output Interpretation

### Directory structure

```
<job_name>/
├── seed-<seed>_sample-<n>/          # Per-sample subdir
│   ├── <job>_confidences.json        # Full confidence arrays
│   ├── <job>_summary_confidences.json # Summary metrics per chain/pair
│   └── <job>_model.cif               # Predicted 3D structure
├── <job_name>_model.cif              # Top-ranked prediction
├── <job_name>_confidences.json       # Top-ranked confidence
├── <job_name>_summary_confidences.json
├── <job_name>_data.json              # Input + MSA + templates
├── ranking_scores.csv                # All predictions ranked
├── seed-<seed>_distogram/            # (if --save_distogram=true)
└── seed-<seed>_embeddings/           # (if --save_embeddings=true)
```

### Confidence metrics

| Metric | Range | What it means |
|--------|-------|---------------|
| **pLDDT** | 0–100 | Per-atom confidence. Higher = better. >90: high, <50: unreliable |
| **PAE** | 0+ (Å) | Predicted aligned error between two tokens. Lower = better |
| **pTM** | 0–1 | Overall fold confidence. >0.5 = likely correct fold |
| **ipTM** | 0–1 | Interface confidence. >0.8 = high, <0.6 = likely failed |
| **ranking_score** | -100–1.5 | Composite for ranking: 0.8×ipTM + 0.2×pTM + 0.5×disorder − 100×clash |

The top-ranked prediction (highest `ranking_score`) is always copied to the root directory.

### Per-chain / per-pair metrics (in summary JSON)

- `chain_ptm[i]` — pTM for chain i alone
- `chain_pair_iptm[i][j]` — ipTM for interface between chains i and j
- `chain_pair_pae_min[i][j]` — minimum PAE between chains i and j (useful for binder/non-binder classification)
- `chain_iptm[i]` — average ipTM of chain i vs all other chains

### Common workflows

- **Rank by specific interface**: use `chain_pair_iptm` for the chain pair of interest
- **Rank by single chain**: use `chain_ptm` for that chain
- **Check binding**: `chain_pair_pae_min` < 10 suggests interaction; > 15 suggests no interaction
- **Select best model**: sort `ranking_scores.csv` by `ranking_score` descending
- **Chirality check**: see `src/alphafold3/model/scoring/chirality.py::compare_chirality`

## Model Architecture

See `references/model-architecture.md` for a deep dive into:

- **Evoformer Trunk**: 48 Pairformer layers processing MSA and template data into single/pair embeddings. MSA channel=64, seq channel=384, pair channel=128.
- **Diffusion Head**: Denoising diffusion process (SIGMA_DATA=16.0, 5 samples) generating 3D atom coordinates from learned noise.
- **Confidence Head**: Predicts pLDDT, PAE, pTM, ipTM from trunk embeddings and predicted structure.
- **Ranking Formula**: `0.8 × ipTM + 0.2 × pTM + 0.5 × disorder − 100 × clash`
- **Key Config**: GlobalConfig (bfloat16, flash attention, sharding), num_recycles=10, num_diffusion_samples=5
- **Flash Attention**: Triton (default) / cuDNN / XLA via `tokamax` library

## Data Pipeline

See `references/data-pipeline.md` for a deep dive into:

- **MSA Search**: Jackhmmer (protein) and Nhmmer (RNA) against sequence alignment databases (BFD, MGnify, UniRef90, UniProt, RNAcentral, NT RNA, Rfam)
- **Template Search**: Hmmsearch against PDB mmCIF structures
- **Sharded Databases**: Split FASTA into shards for 10-30× parallel speedup
- **Featurization Pipeline**: RDKit conformers → atom layout → MSA features → template features → batch assembly
- **Staged Pipeline**: Separate data pipeline (CPU) from inference (GPU) for MSA reuse and distributed execution
- **Database Configuration**: All `JackhmmerConfig`, `NhmmerConfig`, `HmmsearchConfig`, `DatabaseConfig` options

## Performance Tuning

See `references/running.md` → Performance section for:

- Compilation buckets (`--buckets 256,512,...,5376`)
- Sharded sequence alignment databases (10–30× speedup on multi-core machines)
- Unified memory for >5120 tokens
- JAX persistent compilation cache (`--jax_compilation_cache_dir`)

## Troubleshooting

See `references/troubleshooting.md` for:

- V100 produces bad output (clashes, ranking_score -99) — set `XLA_FLAGS`
- SMILES with two-letter atoms (Cl, Br) — check git commit range
- MSA discrepancy vs AlphaFold Server — `--domE` flag tuning
- RDKit conformer failure — `--conformer_max_iterations` or user CCD
- Permission errors on database directories
- Docker mount permission denied

## Development

See `references/development.md` for:

- **Building from Source**: CMake + pybind11 C++ extensions, uv package manager, Docker build
- **Dependencies**: JAX 0.9.1, Haiku 0.0.16, RDKit 2025.9.4, tokamax 0.0.11
- **Running Tests**: GPU inference tests (`run_alphafold_test.py`) and CPU data pipeline tests (`run_alphafold_data_test.py`)
- **Test Data**: Miniature databases, featurised examples, golden outputs for regression testing
- **Debugging**: Key code locations for common issues, useful development flags
- **C++ Extensions**: cif_dict, msa_profile, mkdssp via pybind11

## Codebase Navigation

See `references/codebase-guide.md` for:

- **End-to-End Data Flow**: From input JSON → MSA/templates → featurization → model → output mmCIF
- **Directory Map**: Every source file with line counts and descriptions
- **Configuration Hierarchy**: GlobalConfig → Model.Config → DataPipelineConfig
- **Key Entry Points**: Functions to call for running, building input, data pipeline, model inference, structure I/O
- **C++ Extensions**: What each compiled module provides

## References in This Skill

- `references/input-format.md` — Complete input JSON reference
- `references/running.md` — Docker/Singularity commands, flags, staged pipelines, performance
- `references/troubleshooting.md` — Known issues and solutions
- `references/model-architecture.md` — Model internals: Evoformer, Diffusion Head, Confidence Head, ranking formula
- `references/data-pipeline.md` — Data pipeline: MSA search, template search, sharded databases, featurization
- `references/development.md` — Building from source, dependencies, testing, debugging, C++ extensions
- `references/codebase-guide.md` — Full source code map, data flow, entry points, configuration hierarchy
