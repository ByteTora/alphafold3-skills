# AlphaFold 3 Data Pipeline

## Overview

The data pipeline runs on **CPU** (no GPU needed) and has two main jobs:

1. **MSA search**: Build multiple sequence alignments for protein/RNA chains
2. **Template search**: Find structural templates from PDB for protein chains

After the data pipeline, **featurization** converts the results into model-ready tensor batches.

## Key Source Files

| File | Purpose |
|------|---------|
| `src/alphafold3/data/pipeline.py` | `DataPipeline` and `DataPipelineConfig` — orchestrator |
| `src/alphafold3/data/msa.py` | `Msa` class — MSA container with dedup, crop, concat |
| `src/alphafold3/data/msa_config.py` | Config dataclasses for all tools and databases |
| `src/alphafold3/data/msa_features.py` | MSA → feature one-hot encoding |
| `src/alphafold3/data/msa_pairing.py` | Merging paired/unpaired MSAs across chains |
| `src/alphafold3/data/templates.py` | `Templates` class — Hmmsearch PDB search |
| `src/alphafold3/data/template_realign.py` | Template structure realignment |
| `src/alphafold3/data/featurisation.py` | Bridge: data pipeline → model input features |
| `src/alphafold3/data/tools/jackhmmer.py` | Jackhmmer wrapper (protein MSA) |
| `src/alphafold3/data/tools/nhmmer.py` | Nhmmer wrapper (RNA MSA) |
| `src/alphafold3/data/tools/hmmsearch.py` | Hmmsearch wrapper (template search) |
| `src/alphafold3/data/tools/hmmbuild.py` | Hmmbuild wrapper (HMM profile building) |
| `src/alphafold3/data/tools/hmmalign.py` | Hmmalign wrapper (sequence alignment) |
| `src/alphafold3/data/tools/shards.py` | Sharded database support |
| `src/alphafold3/data/tools/rdkit_utils.py` | RDKit conformer generation |
| `src/alphafold3/data/structure_stores.py` | PDB mmCIF cache during template search |
| `src/alphafold3/data/parsers.py` | FASTA/A3M/STO format parsers (C++ accelerated) |
| `src/alphafold3/model/features.py` | Model input features, padding, batch assembly |
| `src/alphafold3/model/pipeline/pipeline.py` | `WholePdbPipeline` — model-side featurization |
| `src/alphafold3/model/atom_layout/atom_layout.py` | Atom layout conversion for all chain types |

## Genetic Databases

The `fetch_databases.sh` script downloads these databases (~252 GB compressed, ~630 GB uncompressed):

| Database | File | Purpose | Tool |
|----------|------|---------|------|
| BFD (small) | `bfd-first_non_consensus_sequences.fasta` | Metagenomic protein sequences | Jackhmmer |
| MGnify | `mgy_clusters_2022_05.fa` | Metagenomic protein clusters | Jackhmmer |
| UniRef90 | `uniref90_2022_05.fa` | Clustered protein sequences | Jackhmmer |
| UniProt | `uniprot_all_2021_04.fa` | Full UniProt sequences | Jackhmmer |
| RNAcentral | `rnacentral_active_seq_id_90_cov_80_linclust.fasta` | Non-coding RNA | Nhmmer |
| NT RNA | `nt_rna_2023_02_23_clust_seq_id_90_cov_80_rep_seq.fasta` | NCBI NT RNA | Nhmmer |
| Rfam | `rfam_14_9_clust_seq_id_90_cov_80_rep_seq.fasta` | RNA families | Nhmmer |
| PDB mmCIF | `pdb_2022_09_28_mmcif_files.tar.zst` | All PDB structures | Hmmsearch |
| PDB SEQRES | `pdb_seqres_2022_09_28.fasta` | PDB sequences | Hmmsearch |

Database paths use `${DB_DIR}` template resolution — specify one or more `--db_dir` flags. The first directory containing a requested file wins.

## MSA Search

### Protein MSAs (Jackhmmer)

Uses HMMER3's `jackhmmer` for iterative sequence search:

```
Jackhmmer search flow:
  Query sequence → Build HMM profile → Search against BFD/MGnify/UniRef90/UniProt
    → Iterate (default: 1 iteration) → Output A3M alignment
```

**Key flags:**
- `--jackhmmer_binary_path`: Path to jackhmmer binary
- `--jackhmmer_n_cpu`: CPUs per Jackhmmer process
- `--jackhmmer_max_parallel_shards`: Max concurrent shard searches (for sharded DBs)
- `--small_bfd_database_path`, `--mgnify_database_path`, `--uniref90_database_path`, `--uniprot_cluster_annot_database_path`: Database paths
- `--*_z_value`: Database size estimate (for e-value calibration)

### RNA MSAs (Nhmmer)

Uses HMMER3's `nhmmer` for RNA sequence search:

```
Nhmmer search flow:
  Query RNA sequence → Search against RNAcentral/NT RNA/Rfam
    → Output STO alignment → Convert to A3M
```

**Key flags:**
- `--nhmmer_binary_path`: Path to nhmmer binary
- `--nhmmer_n_cpu`: CPUs per Nhmmer process
- `--nhmmer_max_parallel_shards`: Max concurrent shard searches
- `--ntrna_database_path`, `--rfam_database_path`, `--rna_central_database_path`: Database paths

### MSA Pairing

For multimers, MSAs are paired across chains:
- Sequences from the same organism are paired together (using NCBI taxonomy IDs)
- Paired MSAs capture co-evolutionary signal between chains
- Unpaired MSAs provide additional diversity

Control via:
- `--resolve_msa_overlaps`: Resolve taxonomic overlaps between MSA databases
- `--domE` (implicit in tool configs): E-value threshold for domain inclusion
- Custom `unpairedMsa`/`pairedMsa` in input JSON to bypass auto-search

## Template Search

Uses `hmmsearch` to find structural templates in the PDB:

```
Template search flow:
  Query sequence → Build HMM profile → Search against PDB SEQRES
    → Retrieve matching PDB mmCIF files → Filter by date, quality
    → Realign structures to query
```

**Key flags:**
- `--max_template_date`: Max PDB release date for templates (default: 2021-09-30, per paper cutoff)
- `--pdb_database_path`: Path to PDB mmCIF directory
- `--seqres_database_path`: Path to PDB SEQRES FASTA
- `--hmmsearch_binary_path`, `--hmmbuild_binary_path`, `--hmmalign_binary_path`: Tool paths

**Template filtering:**
- Release date cutoff (configurable)
- Minimum alignment quality
- Deduplication (identical structures from same PDB entry)

**Template caching:** Results are cached by sequence via `@functools.cache` — homomultimers reuse the same template search.

## Sharded Databases

For machines with many CPU cores, databases can be split into shards for parallel search:

```bash
# Shard BFD into 16 parts
seqkit shuffle --two-pass bfd.fasta | seqkit split2 --by-part 16 --out-dir bfd_shards/
# Results: bfd-00000-of-00016, bfd-00001-of-00016, ...

# Shard MGnify into 512 parts
seqkit shuffle --two-pass mgnify.fa | seqkit split2 --by-part 512 --out-dir mgnify_shards/
```

Usage:
```bash
--small_bfd_database_path="bfd-first_non_consensus_sequences.fasta@64" \
--small_bfd_z_value=65984053 \
--mgnify_database_path="mgy_clusters_2022_05.fa@512" \
--mgnify_z_value=623796864 \
--jackhmmer_max_parallel_shards=16
```

The `@N` suffix indicates **N shards**. The tool reads `prefix-00000-of-NNNNN` format files.

Achieves **10-30× speedup** on sequence search.

## Featurization

After MSA and template search, `featurisation.featurise_input()` converts results to model input:

### Pipeline Steps

1. **RDKit conformer generation** (`rdkit_utils.py`): Generate 3D conformers for SMILES ligands
2. **Atom layout conversion** (`atom_layout.py`): Map all chain types to unified atom representations
3. **MSA feature extraction** (`msa_features.py`): One-hot encode amino acid types
4. **MSA profile computation** (C++ `msa_profile`): Fast profile generation
5. **Template feature extraction**: Convert PDB templates to model features
6. **Reference structure building**: Build initial structure guess for diffusion
7. **Bond information processing**: Inter-chain and polymer-ligand bond features
8. **Batch assembly**: Pad features to bucket size, create `Batch` dataclass
9. **Validation**: `validate_fold_input()` checks feature consistency

### BatchDict Structure

The `BatchDict` (type alias for `dict[str, np.ndarray | jnp.ndarray]`) contains all model inputs:
- Single features: `token_features`, `ref_pos`, `ref_mask`, `atom_to_token`, etc.
- Pair features: `token_pair_features`, `token_repr_atom`, etc.
- MSA features: `msa`, `msa_mask`, `has_deletion`, `deletion_value`
- Template features: `template_mask`, `template_pair_features`

## Staged Pipeline

Separate data pipeline (CPU) from inference (GPU):

### Data Pipeline Only
```bash
python run_alphafold.py \
  --json_path=input.json \
  --model_dir=/root/models \
  --db_dir=/root/public_databases \
  --output_dir=/root/output \
  --run_inference=false
```
Outputs JSON with pre-computed MSA + templates. Useful for:
- Running MSA on CPU machine, transferring to GPU machine
- Reusing MSA across seeds or ligand variants

### Inference Only
```bash
python run_alphafold.py \
  --json_path=precomputed_data.json \
  --model_dir=/root/models \
  --output_dir=/root/output \
  --run_data_pipeline=false
```
Input JSON must already contain `unpairedMsa`/`pairedMsa`/`templates`.

### MSA Reuse for Combinatorial Screens
1. Run data pipeline for each monomer: A, B, C, D (with `--run_inference=false`)
2. Build dimer JSONs by copying `unpairedMsa`, `pairedMsa`, `templates` from monomer outputs
3. Run inference on dimers with `--run_data_pipeline=false`
4. **Result**: `n + m` data pipeline runs instead of `n × m`

## Data Pipeline Configuration

All configs in `src/alphafold3/data/msa_config.py`:

```python
@dataclasses.dataclass(frozen=True, kw_only=True)
class JackhmmerConfig:
    binary_path: str
    database_path: str
    n_cpu: int = 8
    n_iter: int = 1
    e_value: float = 0.0001
    z_value: int | None = None
    # ... more e-value and filtering params

@dataclasses.dataclass(frozen=True, kw_only=True)
class DatabaseConfig:
    small_bfd_database_path: str = ''
    mgnify_database_path: str = ''
    uniref90_database_path: str = ''
    uniprot_cluster_annot_database_path: str = ''
    ntrna_database_path: str = ''
    rfam_database_path: str = ''
    rna_central_database_path: str = ''
    pdb_database_path: str = ''
    seqres_database_path: str = ''
```
