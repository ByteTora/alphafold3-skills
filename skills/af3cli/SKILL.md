---
name: af3cli
description: "CLI and Python library for generating AlphaFold3 input JSON files. Use when the user wants to: create or modify AlphaFold3 input files, prepare protein/DNA/RNA sequences for AlphaFold3, add ligands/ions/bonds to AlphaFold3 jobs, convert FASTA/SDF to AlphaFold3 input format, or build complex multi-chain AlphaFold3 structures with modifications, templates, and MSA data. Triggers on mentions of AlphaFold3, af3cli, AlphaFold input, AF3 JSON."
---

# af3cli

CLI and Python library for generating AlphaFold3 input JSON files. Repo: https://github.com/SLx64/af3cli

## Quick Start (Install)

```bash
git clone https://github.com/SLx64/af3cli.git
cd af3cli
uv sync --locked
# or: pip install af3cli[biopython,rdkit]
```

## CLI Usage

All commands are chainable with `-`. Show help: `af3cli -- --help`

### Basic Workflow

```bash
# 1. Config
af3cli config -f "output.json" -j "my_job" -v 2

# 2. Random seeds
af3cli seeds -n 5 - \
  # 3. Add sequences
  - protein add "MVKLAGST..." \
  - dna add --sequence "AATTTTCC" \
  - rna add --sequence "UUUGGCCGG" \
  # 4. Add ligands
  - ligand add --smiles "CCC" \
  - ligand add --ccd "MG" \
  # 5. Add bonds
  - bond --add "A:1:C-B:1:O" \
  # 6. Write file
  - debug --show
```

### Key Commands

| Command | Purpose |
|---------|---------|
| `config -f <file> -j <name> -v <version>` | Set output file, job name, AF version |
| `seeds -n <count>` / `seeds -v "1,2,3"` | Generate random seeds or specify list |
| `protein add --sequence <seq>` | Add protein sequence |
| `dna add --sequence <seq>` | Add DNA sequence |
| `rna add --sequence <seq>` | Add RNA sequence |
| `protein add --sequence <fasta> --fasta` | Read sequence from FASTA file |
| `protein [...] - modification <CCD> <pos>` | Add residue modification |
| `protein [...] - template <mmcif> --read` | Add structural template |
| `protein [...] - msa --paired ... --unpaired ...` | Add MSA data |
| `ligand add --smiles <SMILES>` | Add ligand by SMILES |
| `ligand add --ccd <CCD>` | Add ligand by CCD ID |
| `ligand add --sdf <file>` | Read ligands from SDF (needs RDKit) |
| `bond --add "A:1:C-B:1:O"` | Add bonded atom pair (E:R:N-E:R:N) |
| `ccd <filename>` | Add custom CCD mmCIF |
| `protein add -i "A,B"` | Specify chain IDs manually |
| `protein add -n 2` | Specify copy number for homomultimers |
| `merge <file> - protein add ...` | Merge with existing file, add new entries |
| `debug --show` | Preview JSON without writing |

### Sequence descriptions (optional JSON-only comments)

```bash
af3cli protein description "kinase domain of protein X" - add --sequence "MVKLAGST"
```

The description field is auto-excluded for AF version <= 3 (compatibility).

## Python API

```python
from af3cli import InputBuilder
from af3cli import ProteinSequence, DNASequence, RNASequence
from af3cli import SMILigand, CCDLigand
from af3cli import ResidueModification, Template, TemplateType, Bond

builder = InputBuilder()
builder.set_name("my_job")
builder.set_version(2)

# Sequences
prot = ProteinSequence("MVKLAGST...", description="kinase domain")
prot.modifications.append(ResidueModification("SEP", 5))
builder.add_sequence(prot)

dna = DNASequence("AATTTTCC")
rc = dna.reverse_complement()
builder.add_sequence(dna)
builder.add_sequence(rc)

# Ligands
builder.add_ligand(SMILigand("CCC", description="propane"))
builder.add_ligand(CCDLigand(["MG"], description="magnesium"))

# Bonds
builder.add_bonded_atom_pair(Bond.from_string("A:1:C-B:1:O"))

# Seeds
builder.set_seeds([1, 2, 3])

# Write
input_file = builder.build()
input_file.write("output.json")
```

See [references/api-reference.md](references/api-reference.md) for full API docs and [references/cli-reference.md](references/cli-reference.md) for detailed CLI reference.

## Common Patterns

- **FASTA import**: `af3cli protein add --sequence <file> --fasta` or `fasta` top-level command for bulk
- **SDF import**: `af3cli ligand add --sdf ligands.sdf` (requires RDKit)
- **DNA reverse complement**: `dna add --sequence "AATTTTCC" --complement`
- **Merge files**: Use `merge` to combine base system with new ligands/sequences
- **User CCD**: `af3cli ccd my_ligand.cif` for custom CCD mmCIF data
