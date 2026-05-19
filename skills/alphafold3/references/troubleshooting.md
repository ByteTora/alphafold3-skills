# AlphaFold 3 Troubleshooting

## V100 / CUDA 7.x — bad output (clashing residues)

**Symptoms**: Ranking score of -99 or lower, extensive atomic clashes, obviously wrong structures.

**Cause**: Known numerical issues with CUDA Capability 7.x GPUs.

**Fix**: Set the `XLA_FLAGS` environment variable:
```dockerfile
ENV XLA_FLAGS="--xla_disable_hlo_passes=custom-kernel-fusion-rewriter"
```
Disabling Triton GEMM kernels is not needed for these GPUs.

## SMILES with two-letter atoms (Cl, Br, etc.)

**Symptoms**: Ligands defined via SMILES containing two-letter elements (Cl, Br, etc.) are handled incorrectly.

**Affected range**: Commits between `f8df1c7` and `4e4023c`.

**Fix**: Update to the latest commit on the `main` branch. If updating is not possible, use CCD codes instead of SMILES for ligands containing two-letter atoms.

## MSA discrepancy vs AlphaFold Server

**Symptoms**: Local run gives lower pTM/ipTM than AlphaFold Server for the same input, especially for protein-DNA complexes.

**Cause**: AlphaFold Server uses sharded databases without `--domZ`, making its `--domE` filter ~100× more permissive, producing a deeper MSA.

**Fix**: Increase Jackhmmer/Nhmmer `--domE` by 100×, or use sharded databases (see `references/running.md` → Sharded genetic databases).

Recommendation: If a prediction has low confidence scores, experiment with deeper MSA to potentially improve accuracy.

## RDKit conformer generation failure

**Symptoms**: `Failed to construct RDKit reference structure` error for a ligand.

**Causes and fixes**:

1. **Increase conformer iterations**:
   ```bash
   --conformer_max_iterations=<higher_number>
   ```

2. **Provide ideal coordinates via user CCD**: Define the ligand in the CCD mmCIF format with `pdbx_model_Cartn_*_ideal` coordinates. The model will use these as fallback.

3. **Check if RDKit supports the molecule**: Some unusual valences or coordination geometries may not be handled by RDKit.

## Permission errors

**Database directory** — opaque errors from MSA tools:
```bash
sudo chmod 755 --recursive <DB_DIR>
```

**Docker mount** — "permission denied" on volume mount:
Make sure source directories exist and are writable:
```bash
mkdir -p $HOME/af_input $HOME/af_output
chmod 755 $HOME/af_input $HOME/af_output
```

**Model parameters** — `docker: Error response from daemon: error while creating mount source path`:
Ensure `<MODEL_PARAMETERS_DIR>` exists and is readable.

## OOM (out of memory)

**GPU OOM**: Reduce input size, enable unified memory (see `references/running.md` → GPU memory), or adjust `pair_transition_shard_spec`.

**RAM OOM** (during data pipeline): Large MSAs can consume >64 GB RAM. Increase system RAM or run data pipeline on a machine with more memory.

## Singularity — GPU not detected

```bash
singularity exec --nv alphafold3.sif nvidia-smi  # Verify GPU access
```

If GPU is not visible, restart the machine or reinstall the NVIDIA container toolkit.

## Compilation is very slow

**Symptom**: Model compilation takes >30 minutes.

**Workaround**: JAX compilation cache:
```bash
--jax_compilation_cache_dir /path/to/cache
```
First run will still be slow, but subsequent runs will reuse the cache.

Also ensure `XLA_FLAGS` includes `--xla_gpu_enable_triton_gemm=false` (set by default in Dockerfile).

## Multi-chain input — wrong chain numbering in output

AlphaFold 3 assigns entity IDs from the input JSON `id` field. Ensure each entity has a unique ID and that the IDs follow the expected format (uppercase letters, starting from A).
