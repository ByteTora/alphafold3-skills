# AlphaFold 3 Codebase Guide

## Data Flow (End-to-End)

```
Input JSON → folding_input.Input
    │
    ▼
DataPipeline.process() [CPU]
    │
    ├── Jackhmmer → protein MSAs (BFD, MGnify, UniRef90, UniProt)
    ├── Nhmmer → RNA MSAs (RNAcentral, NT RNA, Rfam)
    ├── Hmmsearch → template structures (PDB mmCIF)
    └── fills fold_input with MSA + templates
    │
    ▼
featurisation.featurise_input() [CPU]
    │
    ├── RDKit conformer generation (for SMILES ligands)
    ├── Atom layout conversion (all chain types → unified representation)
    ├── MSA one-hot encoding + profile computation
    ├── Template feature extraction
    ├── Bond information processing
    └── Padding to bucket size → BatchDict
    │
    ▼
ModelRunner.run_inference() [GPU]
    │
    ├── Evoformer Trunk (48 layers)
    │   ├── MSA processing → single_embeddings
    │   ├── Template processing → pair_embeddings
    │   └── Atom cross-attention (per-token ↔ per-atom)
    │
    ├── Diffusion Head
    │   ├── Denoising diffusion (5 samples)
    │   ├── Random rigid augmentation
    │   └── → atom coordinates
    │
    └── Confidence Head
        ├── Distogram (distance histogram)
        ├── pLDDT (per-atom confidence)
        ├── PAE (predicted aligned error)
        ├── pTM / ipTM (global/interface scores)
        └── → confidence metrics
    │
    ▼
InferenceResult → post_process → mmCIF + JSON + NPZ + CSV
```

## Directory Map

### `src/alphafold3/common/` — Shared Utilities

| File | Lines | Key Content |
|------|-------|-------------|
| `folding_input.py` | ~600 | `Input`, `ProteinChain`, `RnaChain`, `DnaChain`, `Ligand`, `Template` dataclasses. JSON↔mmCIF serialization. Dialects: `alphafold3` and `alphafoldserver`. |
| `base_config.py` | ~200 | `ConfigMeta` metaclass for all configs. Auto-coercion of dicts to nested Configs. |
| `resources.py` | ~50 | Filesystem access via `importlib.resources`. `ROOT` path resolver. |

### `src/alphafold3/constants/` — Data Constants

| File | Key Content |
|------|-------------|
| `residue_names.py` | 3-letter↔1-letter CCD codes for all residues. Standard 20 AA, RNA (A,G,C,U), DNA (DA,DG,DC,DT). |
| `mmcif_names.py` | mmCIF chain types, bond types, crystallization methods. |
| `chemical_components.py` | `Ccd` class wrapping pickle-loaded chemical component dictionary. ~20K components. |
| `chemical_component_sets.py` | Grouping: standard residues, modified residues, ligands. |
| `periodic_table.py` | Atomic numbers and element properties. |
| `atom_types.py` | Atom type names (CA, CB, C1PRIME, etc.). |
| `side_chains.py` | Side-chain atom definitions per residue. |

### `src/alphafold3/data/` — Data Pipeline

| File | Lines | Key Content |
|------|-------|-------------|
| `pipeline.py` | 594 | `DataPipeline` orchestrator. ThreadPoolExecutor parallelism. Sequence-result caching. |
| `msa.py` | ~400 | `Msa` class: dedup, concatenate, crop, A3M parse, STO write. |
| `msa_config.py` | ~200 | Frozen kw-only dataclasses: `JackhmmerConfig`, `NhmmerConfig`, `HmmsearchConfig`, `DatabaseConfig`, etc. |
| `templates.py` | ~400 | `Templates` class. Hmmsearch against PDB. Filter by date, quality, dedup. |
| `featurisation.py` | ~200 | Bridge: calls `WholePdbPipeline.process_item()`. `validate_fold_input()`. |
| `tools/jackhmmer.py` | ~200 | Python subprocess wrapper for jackhmmer binary. |
| `tools/nhmmer.py` | ~150 | Python subprocess wrapper for nhmmer binary. |
| `tools/hmmsearch.py` | ~100 | Python subprocess wrapper for hmmsearch binary. |
| `tools/hmmbuild.py` | ~80 | Python subprocess wrapper for hmmbuild binary. |
| `tools/hmmalign.py` | ~80 | Python subprocess wrapper for hmmalign binary. |
| `tools/shards.py` | ~100 | Sharded FASTA database support. |
| `tools/rdkit_utils.py` | ~100 | RDKit conformer generation, reference structure building. |
| `structure_stores.py` | ~100 | PDB mmCIF cache for template search. |
| `parsers.py` | ~100 | FASTA/A3M/STO parsers with C++ acceleration. |

### `src/alphafold3/model/` — Neural Network

| File | Lines | Key Content |
|------|-------|-------------|
| `model.py` | 519 | `Model` class, `InferenceResult`, forward pass orchestration, `get_predicted_structure()`. |
| `model_config.py` | 35 | `GlobalConfig`: bfloat16, flash attention, sharding specs. |
| `params.py` | ~200 | Model weight loading. Multi-file I/O. Binary record format. |
| `features.py` | 2174 | ~30 feature dataclasses. `BatchDict` type. Padding, batch assembly. |
| `feat_batch.py` | ~50 | `Batch` dataclass aggregating all features. |
| `confidences.py` | 663 | pLDDT, PAE, pTM, ipTM, ranking, clash detection, disorder, RSA. |
| `confidence_types.py` | ~100 | `AtomConfidence`, `StructureConfidenceSummary`, `StructureConfidenceFull`. |
| `post_processing.py` | ~200 | `write_output()`, `write_embeddings()`, `post_process_inference_result()`. |
| `mmcif_metadata.py` | ~50 | Metadata fields in output mmCIF. |
| `data3.py` | ~200 | MSA profile computation, template → atom37 conversion. |
| `data_constants.py` | ~50 | MSA gap index, feature group names. |
| `msa_pairing.py` | ~150 | Multimer MSA deduplication and organism-based pairing. |

### `src/alphafold3/model/network/` — Neural Network Layers

| File | Lines | Key Content |
|------|-------|-------------|
| `evoformer.py` | 347 | `Evoformer` trunk. `PairformerConfig` (48 layers). MSA channel=64, seq=384, pair=128. |
| `diffusion_head.py` | 369 | Denoising diffusion. `SIGMA_DATA=16.0`. Random augmentation. |
| `diffusion_transformer.py` | ~200 | Transformer blocks for diffusion process. |
| `confidence_head.py` | ~200 | Predicts pLDDT, PAE, pTM, ipTM from embeddings. |
| `distogram_head.py` | ~100 | Distance histogram (contact probability at <8Å). |
| `modules.py` | 626 | `TransitionBlock`, `PairFormerIteration`, `TriangleMultiplication`, `TriangleAttention`, `OuterProduct`. |
| `atom_cross_attention.py` | ~150 | Cross-attention: per-token ↔ per-atom (`AtomCrossAttEncoderConfig`). |
| `template_modules.py` | ~150 | Template structure processing and embedding. |
| `featurization.py` | ~200 | Network-side featurization: embeddings from raw features. |
| `noise_level_embeddings.py` | ~50 | Fourier-based noise level embeddings for diffusion. |

### `src/alphafold3/model/components/`

| File | Key Content |
|------|-------------|
| `haiku_modules.py` | Custom Haiku modules: `LayerNorm`, `Linear`, etc. |
| `mapping.py` | Tensor mapping/reshaping. |
| `utils.py` | Feature type validation, general utilities. |

### `src/alphafold3/model/pipeline/`

| File | Key Content |
|------|-------------|
| `pipeline.py` | `WholePdbPipeline`: fold input → batch dictionary. |
| `structure_cleaning.py` | Structure preprocessing. |
| `inter_chain_bonds.py` | Inter-chain bond processing. |

### `src/alphafold3/model/atom_layout/`

| File | Lines | Key Content |
|------|-------|-------------|
| `atom_layout.py` | 1095 | `AtomLayout`, `GatherInfo`. Atom37 ↔ dense atom conversion. All chain types. |

### `src/alphafold3/model/scoring/`

| File | Key Content |
|------|-------------|
| `scoring.py` | General scoring utilities. |
| `alignment.py` | RMSD computation for structure comparison. |
| `chirality.py` | Chirality checking (Posebusters validation). |

### `src/alphafold3/structure/` — 3D Structure

| File | Lines | Key Content |
|------|-------|-------------|
| `structure.py` | ~800 | `Structure` class: atoms, residues, chains, bonds as numpy arrays. mmCIF I/O, bioassembly, filtering. |
| `structure_tables.py` | ~100 | `Atoms`, `Chains`, `Residues` table types. |
| `table.py` | ~200 | Generic table abstraction. |
| `mmcif.py` | ~300 | mmCIF parsing/writing. `int_id_to_str_id()`. |
| `parsing.py` | ~200 | `from_mmcif()`, `from_sequences_and_bonds()`, `from_atom_arrays()`. |
| `bioassemblies.py` | ~200 | PDB biological assembly generation. |
| `bonds.py` | ~150 | Bond representation and processing. |
| `chemical_components.py` | ~150 | `ChemCompEntry`, `ChemicalComponentsData`. |

### `src/alphafold3/jax/geometry/` — Geometric Operations

| File | Key Content |
|------|-------------|
| `vector.py` | `Vec3Array`: Struct-of-arrays 3D vector (x, y, z as separate jnp arrays). |
| `rotation_matrix.py` | `Rot3Array`: 3D rotation matrix operations. |
| `rigid_matrix_vector.py` | Rigid transformations (rotation + translation). |
| `struct_of_array.py` | Metaclass for struct-of-arrays pattern. |
| `utils.py` | Geometry utilities. |

## Configuration Hierarchy

```
GlobalConfig (model_config.py)
├── bfloat16: 'all' | 'none' | 'intermediate'
├── flash_attention_implementation: 'triton' | 'cudnn' | 'xla'
├── pair_attention_chunk_size
└── pair_transition_shard_spec

Model.Config (model.py)
├── global_config: GlobalConfig
├── num_recycles: int = 10
├── return_embeddings: bool = False
├── return_distogram: bool = False
├── num_diffusion_samples: int = 5
└── ...

DataPipelineConfig (data/pipeline.py)
├── jackhmmer_configs: Sequence[JackhmmerConfig]
├── nhmmer_configs: Sequence[NhmmerConfig]
├── template_configs: Sequence[TemplatesConfig]
└── max_template_date: datetime.date
```

## Key Entry Points

### For Running
- `run_alphafold.py::main()` — CLI entry, parses flags, orchestrates pipeline
- `run_alphafold.py::process_fold_input()` — Per-input processing (data + inference)
- `run_alphafold.py::ModelRunner.run_inference()` — GPU model forward pass

### For Building Input
- `src/alphafold3/common/folding_input.py::Input.from_json()` — Parse input JSON
- `src/alphafold3/common/folding_input.py::Input.from_mmcif()` — Parse from mmCIF

### For Data Pipeline
- `src/alphafold3/data/pipeline.py::DataPipeline.process()` — Run MSA + template search
- `src/alphafold3/data/featurisation.py::featurise_input()` — Convert to model input

### For Model
- `src/alphafold3/model/model.py::Model.__call__()` — Full forward pass
- `src/alphafold3/model/params.py::get_model_haiku_params()` — Load weights
- `src/alphafold3/model/post_processing.py::write_output()` — Write results

### For Structure
- `src/alphafold3/structure/parsing.py::from_mmcif()` — Load structure from mmCIF
- `src/alphafold3/structure/structure.py::Structure.to_mmcif()` — Export to mmCIF

## C++ Extensions

The compiled `alphafold3.cpp` module provides:

```python
import alphafold3.cpp

# Parse mmCIF file into Python dict
cif_dict = alphafold3.cpp.cif_dict  # fast CIF reader (libcifpp)

# Compute MSA profile (one-hot amino acid frequencies)
profile = alphafold3.cpp.msa_profile  # (sequence_count, alignment_length, 22)

# Run DSSP on a structure
dssp_output = alphafold3.cpp.mkdssp.get_dssp(cif_string)

# mmCIF parsing utilities
alphafold3.cpp.*  # various structure parsing helpers
```
