# AlphaFold 3 Development Guide

## Building from Source

### Prerequisites

- **Python** >= 3.12
- **C++20 compiler** (GCC 11+ or Clang 16+)
- **CMake** >= 3.28
- **Ninja** build system
- **CUDA Toolkit** 12.x (for GPU support)
- **HMMER 3.4** binaries (jackhmmer, nhmmer, hmmsearch, hmmalign, hmmbuild)
- **uv** package manager (v0.9.24+)

### Build Process

The project uses `scikit_build_core` which wraps CMake and pybind11:

```bash
# Clone the repository
git clone https://github.com/google-deepmind/alphafold3.git
cd alphafold3

# Install Python dependencies and build C++ extensions
uv sync --frozen --all-groups --no-editable

# Build CCD (Chemical Component Dictionary) data
uv run build_data

# Verify installation
uv run python -c "import alphafold3; print(alphafold3.__version__)"
```

### C++ Extensions

The compiled C++ module (`alphafold3.cpp`) provides high-performance implementations:

| Extension | Source | Purpose |
|-----------|--------|---------|
| `cif_dict` | `parsers/cpp/` | Fast mmCIF file parsing (libcifpp-based) |
| `msa_profile` | `data/cpp/` | MSA profile computation |
| `mkdssp` | `structure/cpp/` | Secondary structure assignment (DSSP) |
| mmCIF utilities | `structure/cpp/` | Atom site parsing, structure aggregation |

The CMakeLists.txt fetches these dependencies:
- **abseil-cpp** (20240116.2): Google's C++ library
- **pybind11** (v2.12.0): Python/C++ binding
- **pybind11_abseil**: Abseil types in pybind11
- **libcifpp** (v7.0.3): CIF file parsing library
- **dssp** (v4.4.7): Secondary structure assignment

### Docker Build

```bash
# Build the Docker image (from project root)
docker build -t alphafold3 -f docker/Dockerfile .

# The Dockerfile automates:
# 1. Base: nvidia/cuda:12.6.3-base-ubuntu24.04
# 2. Install system deps (Python 3.12, build tools, zstd)
# 3. Install uv package manager
# 4. Build HMMER 3.4 from source (with jackhmmer_seq_limit.patch)
# 5. Copy source, run uv sync, build CCD data
# 6. Set XLA environment variables
```

### Key Docker Environment Variables

```dockerfile
ENV XLA_FLAGS="--xla_gpu_enable_triton_gemm=false"  # Workaround for XLA issue
ENV XLA_PYTHON_CLIENT_PREALLOCATE=true               # Pre-allocate GPU memory
ENV XLA_CLIENT_MEM_FRACTION=0.95                     # Use 95% of GPU memory
```

## Project Structure

```
alphafold3/
├── run_alphafold.py              # Main inference entry point (998 lines)
├── run_alphafold_test.py         # GPU inference integration tests (430 lines)
├── run_alphafold_data_test.py    # CPU data pipeline tests (281 lines)
├── pyproject.toml                # Build config, dependencies, metadata
├── CMakeLists.txt                # C++ build configuration (100 lines)
├── Dockerfile                    # Docker image definition (88 lines)
├── fetch_databases.sh            # Database download script
├── uv.lock                       # Locked dependency versions
├── .github/workflows/ci.yaml     # GitHub Actions CI (CPU tests only)
├── docker/                       # Docker-related files
├── docs/                         # Official documentation
├── legal/                        # Translated legal documents
└── src/alphafold3/               # Main Python package
    ├── __init__.py
    ├── version.py                # Version: 3.0.2
    ├── build_data.py             # Builds CCD pickle from CIF data
    ├── common/                   # Shared utilities (config, folding_input, resources)
    ├── constants/                # Chemical/physical constants, CCD, residue mappings
    ├── data/                     # Data pipeline (MSA, templates, featurization)
    ├── jax/geometry/             # JAX geometry (Vec3Array, rotations, rigid transforms)
    ├── model/                    # Model architecture, features, confidence, scoring
    ├── parsers/                  # CIF/FASTA parsers (C++ backed)
    ├── scripts/                  # Utility shell scripts
    ├── structure/                # 3D structure representation (mmCIF I/O)
    └── test_data/                # Test fixtures (miniature DBs, golden outputs)
```

## Dependencies

### Runtime (from pyproject.toml)

| Package | Version | Purpose |
|---------|---------|---------|
| `absl-py` | >=2.3.1 | CLI flags (absl.flags), logging, testing |
| `dm-haiku` | ==0.0.16 | DeepMind neural network library |
| `jax` / `jax[cuda12]` | ==0.9.1 | GPU-accelerated array computation |
| `numpy` | latest | Array operations |
| `rdkit` | ==2025.9.4 | Cheminformatics (SMILES, conformers) |
| `tokamax` | ==0.0.11 | Flash attention (Triton/cuDNN implementations) |
| `tqdm` | latest | Progress bars |
| `zstandard` | latest | Compression for large outputs |

### Dev Dependencies
- `pytest` >= 6.0

### Platform
- **OS**: Linux only (`sys_platform == 'linux'`)
- **Arch**: x86_64, aarch64
- **Python**: >= 3.12

## Running Tests

### Test Infrastructure

The project has two test files using `absl.testing` framework:

#### 1. `run_alphafold_data_test.py` — CPU Data Pipeline Tests (281 lines)

```bash
# Can run without GPU
uv run python run_alphafold_data_test.py
```

Tests:
- `test_config()`: Serializes model config to JSON, compares against golden file
- `test_featurisation()`: Runs full data pipeline + featurisation, hashes output for golden comparison
- `test_write_input_json()`: JSON round-trip serialization test
- `test_process_fold_input_runs_only_data_pipeline()`: Data pipeline without inference
- `test_replace_db_dir()`: `${DB_DIR}` template resolution with single/multiple fallbacks

Uses `_hash_data()` (functools.singledispatch) for deterministic hashing of numpy arrays, JAX arrays, and structures for golden file comparison.

#### 2. `run_alphafold_test.py` — GPU Inference Tests (430 lines)

```bash
# Requires GPU
uv run python run_alphafold_test.py
```

Tests:
- `test_model_inference()`: Loads pre-computed featurised example, runs inference, checks embeddings
- `test_process_fold_input_runs_only_inference()`: Verifies error without MSA
- `test_inference()` (parameterized): Full pipeline + inference with golden output comparison
  - Validates output directory structure
  - Checks embedding shapes and dtypes
  - Validates distogram shape
  - Checks ranking scores in expected range [0.66, 0.78]
  - Structure RMSD vs expected (< 3.0 full, < 1.4 masked)
  - Token chain IDs match input

### Test Data

Located in `src/alphafold3/test_data/`:

| File/Dir | Purpose |
|----------|---------|
| `model_config.json` | Expected model config for golden testing |
| `featurised_example.pkl` / `.json` | Pre-computed featurized input for inference tests |
| `alphafold_run_outputs/` | Expected inference outputs for regression testing |
| `miniature_databases/` | Subsamples (~1000 seqs each) of all genetic databases + 2 PDB mmCIFs |

### CI

GitHub Actions workflow (`.github/workflows/ci.yaml`) runs CPU tests only (no GPU in CI).

## Debugging

### Useful Development Flags

```bash
# Save embeddings for inspection
--save_embeddings=true

# Save distogram (large, ~3 GiB)
--save_distogram=true

# Force overwrite output
--force_output_dir=true

# Disable compilation cache for consistent recompilation
# (in code: jax.config.update('jax_enable_compilation_cache', False))

# Run with specific bucket for faster compilation
--buckets=256

# Reduce samples/recycles for faster iteration
--num_diffusion_samples=1
--num_recycles=1
```

### Inspecting Model Internals

```python
# Access model outputs programmatically
from alphafold3.model import model, params, features
import haiku as hk

# Load params
haiku_params = params.get_model_haiku_params(model_dir='path/to/models')

# Create model
model_config = model.make_model_config(...)
forward = hk.transform(lambda batch: model.Model(model_config)(batch))
```

### Key Code Locations for Debugging

| Issue | Look at |
|-------|---------|
| Confidences look wrong | `model/confidences.py` — `get_ranking_score()`, `fraction_disordered()`, `has_clash()` |
| Template search failing | `data/templates.py` — `Templates.from_seq_and_a3m()` |
| MSA too shallow | `data/tools/jackhmmer.py` — check e-value (`--domE`) and `z_value` |
| RDKit conformer error | `data/tools/rdkit_utils.py` — conformer generation logic |
| Atom layout mismatch | `model/atom_layout/atom_layout.py` — chain type handling |
| Output mmCIF issues | `structure/mmcif.py`, `structure/structure.py` |
| JAX compilation issues | Check `XLA_FLAGS`, `tokamax` version, CUDA version |

## Contributing

From `CONTRIBUTING.md`:
- Pull requests accepted as **patches only** (not forks)
- Requires signing Google's Contributor License Agreement (CLA)
- License: CC BY-NC-SA 4.0

## Version

Current version: **3.0.2** (from `src/alphafold3/version.py` and `pyproject.toml` fallback)
