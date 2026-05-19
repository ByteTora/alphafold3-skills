# AlphaFold 3 Model Architecture

## Overview

AlphaFold 3 uses a **two-stage neural network** built with JAX and Haiku:

```
Input Features → Evoformer Trunk (48 layers) → single + pair embeddings
                                                 ↓
                              ┌──────────────────┴──────────────────┐
                              ↓                                     ↓
                      Diffusion Head                        Confidence Head
                   (denoising diffusion)              (pLDDT, PAE, pTM, ipTM)
                              ↓                                     ↓
                      Atom Coordinates                    Confidence Metrics
```

The model operates in **bfloat16** throughout (configurable via `GlobalConfig.bfloat16`). Each inference runs **N recycle iterations** (default: 10), where the output of one iteration feeds the next.

## Key Source Files

| File | Purpose |
|------|---------|
| `src/alphafold3/model/model.py` | Top-level `Model` class, `InferenceResult`, forward pass orchestration |
| `src/alphafold3/model/model_config.py` | `GlobalConfig` - precision, flash attention, sharding |
| `src/alphafold3/model/params.py` | Model parameter loading from `.bin`/`.bin.zst` files |
| `src/alphafold3/model/features.py` | Feature dataclasses (~30 types) and input processing (2174 lines) |
| `src/alphafold3/model/feat_batch.py` | `Batch` dataclass aggregating all features |
| `src/alphafold3/model/network/evoformer.py` | Evoformer trunk network |
| `src/alphafold3/model/network/diffusion_head.py` | Diffusion-based structure prediction |
| `src/alphafold3/model/network/diffusion_transformer.py` | Transformer blocks for diffusion |
| `src/alphafold3/model/network/confidence_head.py` | Confidence metric prediction |
| `src/alphafold3/model/network/distogram_head.py` | Distance histogram prediction |
| `src/alphafold3/model/network/modules.py` | Reusable NN blocks: TransitionBlock, PairFormerIteration, etc. |
| `src/alphafold3/model/network/atom_cross_attention.py` | Cross-attention between token and atom representations |
| `src/alphafold3/model/network/template_modules.py` | Template structure embedding |
| `src/alphafold3/model/network/featurization.py` | Network-side feature → embedding conversion |
| `src/alphafold3/model/network/noise_level_embeddings.py` | Fourier noise embeddings for diffusion |
| `src/alphafold3/model/confidences.py` | Confidence computation: pLDDT, PAE, pTM, ipTM, ranking |
| `src/alphafold3/model/post_processing.py` | Output writing: mmCIF, JSON, embeddings, distograms |
| `src/alphafold3/model/atom_layout/atom_layout.py` | Atom representation conversion system (1095 lines) |

## Global Configuration

Defined in `src/alphafold3/model/model_config.py`:

```python
class GlobalConfig:
    bfloat16: 'all' | 'none' | 'intermediate' = 'all'
    final_init: 'zeros' | 'linear' = 'zeros'
    pair_attention_chunk_size: [(1536, 128), (None, 32)]
    pair_transition_shard_spec: [(2048, None), (None, 1024)]
    flash_attention_implementation: 'triton' | 'cudnn' | 'xla' = 'triton'
```

- **bfloat16**: `'all'` = full BF16 model, `'none'` = FP32, `'intermediate'` = BF16 only in intermediate computations
- **flash_attention_implementation**: `'triton'` (via tokamax), `'cudnn'` (cuDNN Fused Attention), `'xla'` (no flash attention)
- **pair_transition_shard_spec**: Controls tensor sharding across devices. For A100 40GB or >5120 tokens, adjust sharding

## The Forward Pass

The `Model.__call__()` method in `model.py` orchestrates:

1. **Feature preprocessing**: `featurization.lift_msa_and_templates()` converts raw features to embeddings
2. **Evoformer trunk**: Produces `single_embeddings` (per-token) and `pair_embeddings` (per-token-pair)
3. **Diffusion head**: Takes embeddings + random noise → denoises to produce atom coordinates (5 samples)
4. **Confidence head**: Takes embeddings + predicted structure → pLDDT, PAE, pTM, ipTM
5. **InferenceResult extraction**: Converts model tensors to `Structure` objects + metrics

## Evoformer Trunk

The core neural network in `evoformer.py` that processes MSA and template data:

### Architecture
- **48 Pairformer layers** (`num_layer=48`) -- the main trunk
- **MSA channel dimension**: 64
- **Sequence channel dimension**: 384
- **Pair channel dimension**: 128
- **Max relative index**: 32 (relative positional encoding)
- **Max MSA sequences**: 1024 (MSA is subsampled/clipped)
- **Max relative chain**: 2

### PairformerIteration
Each layer is a `PairFormerIteration` block containing:
- **Pair Transition** (GLU-kernel MLP on pair representation)
- **Triangle Multiplication** (outgoing + incoming)
- **Triangle Attention** (starting + ending node)
- **Single Attention with Pair Bias** (MSA rows attend with pair-conditioned biases)
- **Single Transition**

### Input Processing
- MSA features → `featurization.lift_msa_and_templates()` → initial single/pair embeddings
- Template features → `template_modules` → template pair embeddings
- Atom cross-attention (`atom_cross_attention.py`): Enables per-token ↔ per-atom communication

### Outputs
- **single_embeddings**: shape `[num_tokens, seq_channel=384]` — per-residue representations
- **pair_embeddings**: shape `[num_tokens, num_tokens, pair_channel=128]` — pairwise representations

## Diffusion Head

Implements denoising diffusion for 3D structure generation (`diffusion_head.py`):

### Key Parameters
- **SIGMA_DATA = 16.0**: Standard deviation of training data noise (calibrated on multimer training set)
- **Default diffusion samples**: 5 (per seed)
- **Recycle iterations**: 10 (each iteration feeds output back as input)

### Process
1. Start with random Gaussian noise for atom coordinates
2. Add **Fourier noise level embeddings** (`noise_level_embeddings.py`) to condition on noise level
3. Apply **random rigid augmentation** (rotation + translation) for training/inference
4. Iteratively denoise through diffusion steps using `DiffusionTransformer` blocks
5. Convert final denoised coordinates to `Structure` via `atom_layout` system

### DiffusionTransformer
Specialized transformer blocks in `diffusion_transformer.py` that operate on the diffusion state, conditioned on the trunk's single/pair embeddings.

## Confidence Head

Predicts confidence metrics from trunk embeddings and predicted structure (`confidence_head.py`):

### Outputs
- **pLDDT** (predicted Local Distance Difference Test): Per-atom confidence, 0-100
- **PAE** (Predicted Aligned Error): Per-token-pair error in Ångstroms
- **pTM** (predicted TM-score): Overall fold confidence, 0-1
- **ipTM** (predicted interface TM-score): Interface confidence, 0-1

### Distogram Head
The `distogram_head.py` predicts a distance histogram between all token pairs, which feeds into:
- PAE computation
- Contact probability estimation (distance < 8Å)
- Ranking score computation via `confidences.rank_metric()`

## Confidence Metrics Computation

Computed in `confidences.py`:

### pLDDT
Per-atom prediction of the local distance difference test score. Higher = more confident.

### PAE (Predicted Aligned Error)
`chain_pair_pae()` computes:
- **chain_pair_pae_mean[i][j]**: Average PAE between chain i and j
- **chain_pair_pae_min[i][j]**: Minimum PAE between chain i and j

Chain pair PAE minimum < 10 typically indicates interaction; > 15 suggests no interaction.

### pTM
`predicted_tm_score()` computes TM-score from PAE:
```
pTM = max_i( Σ_j f_ij / (1 + (PAE_ij / d_0)²) )
```
where `f_ij` is the fraction of aligned residue pairs and `d_0` is a length-dependent normalization.

### ipTM
Same as pTM but restricted to **cross-chain** residue pairs (interface = True):
- For single-chain inputs, ipTM = NaN → ranking falls back to pTM alone

### Ranking Score
```python
# Single chain (ipTM is NaN):
ranking_score = pTM + 0.5 * fraction_disordered - 100 * has_clash

# Multi-chain:
ranking_score = 0.8 * ipTM + 0.2 * pTM + 0.5 * fraction_disordered - 100 * has_clash
```

### Clash Detection
`has_clash()` detects catastrophic chain overlaps:
- Uses kD-tree spatial query (`scipy.spatial.cKDTree`)
- Atoms within 1.1Å of non-adjacent residues (or different chains) count as clashes
- A chain is "clashing" if >100 atoms have clashes OR >50% of atoms are clashing

### Disorder Detection
`fraction_disordered()` uses AlphaFold-RSA:
- Computes solvent accessible surface area via DSSP (C++ extension `mkdssp`)
- Residues with `rASA > 0.581` are considered disordered
- Window-averaged over 25 residues

## Model Parameters

Model weights (`params.py`):
- Stored as Haiku parameters in binary format (`.bin` files, optionally `.bin.zst` compressed)
- Multiple shard files: `af3.bin`, `af3.bin.zst`, `af3-01of??.bin.zst` etc.
- `_MultiFileIO` handles concatenated weight shards transparently
- `get_model_haiku_params()` loads and returns Haiku params for the model

## JAX Compilation

The model uses JAX's JIT compilation:
- First run (per input size bucket) triggers XLA compilation (~5-30 minutes)
- Subsequent runs for same bucket size reuse compiled code
- **Compilation cache** (`--jax_compilation_cache_dir`): Persist compiled functions across runs
- **Buckets** (`--buckets`): Pre-compile for multiple input sizes to avoid recompilation

### Compilation Buckets
Default buckets: `256, 512, 768, 1024, 1280, 1536, 2048, 2560, 3072, 3584, 4096, 4608, 5120`

Inputs are padded up to the nearest bucket size. Smaller inputs compile faster but use more memory padding.

## Flash Attention

The model uses attention implementations from the `tokamax` library:
- **triton**: Triton-based flash attention (default, best performance on modern GPUs)
- **cudnn**: NVIDIA cuDNN fused attention
- **xla**: XLA native attention (no flash attention, slowest)

Set via `GlobalConfig.flash_attention_implementation` or `--flash_attention_implementation` flag.
