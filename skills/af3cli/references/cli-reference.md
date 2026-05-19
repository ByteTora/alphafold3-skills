# af3cli CLI Reference

## Overview

Chain commands with `-`. Top-level commands chain to subcommands.

```bash
af3cli toplevel sub [...] - sub [...] - toplevel sub [...]
```

All help: `af3cli -- --help`

## Commands

### config
```bash
af3cli config -f "filename.json" -j "jobname" -v 2
```
- `-f / --filename`: Output JSON filename
- `-j / --jobname`: Job name
- `-v / --version`: AlphaFold3 format version

### seeds
```bash
af3cli seeds -n 10 - ...        # generate 10 random seeds
af3cli seeds -v "1,2,3" - ...  # explicit list
```
- `-n / --number`: Count of random seeds
- `-v / --values`: Comma-separated list, tuple, or bracket list

### protein / dna / rna
```bash
af3cli [protein|dna|rna] add --sequence <seq>
af3cli [protein|dna|rna] description <text> - add --sequence <seq>
```

**Sequence sub-commands:**
- `add --sequence <seq>`: Add sequence (positional or `--sequence`)
- `add --sequence <fasta> --fasta`: Read from FASTA (needs Biopython)
- `description <text>`: Optional text comment (auto-excluded for AF v<=3)
- `modification <CCD> <pos>`: Add modification (`--mod` / `--pos` also valid)
- `template <mmcif_file> --read`: Read template as string (vs path)
- `template -q "1,2,3" -t "1,2,3"`: Query/template indices
- `msa --paired <text> --unpaired <text>`: MSA content
- `msa --pairedpath <file> --unpairedpath <file>`: MSA file paths
- `-i "A,B"`: Manual chain IDs
- `-n 2`: Copy number

### ligand
```bash
af3cli ligand add --smiles "CCC"
af3cli ligand add --ccd "MG"
af3cli ligand add --sdf ligands.sdf
af3cli ligand description <text> - add --smiles "CCC"
```
- `--smiles`: SMILES string
- `--ccd`: CCD code(s) for ions/ligands
- `--sdf`: SDF file (needs RDKit)
- `description <text>`: Optional text comment
- `-i "A,B"`: Manual IDs
- `-n 2`: Copy number

### fasta
```bash
af3cli fasta <filename>
```
Read multiple sequences from FASTA file. Auto-detects sequence type.

### ccd
```bash
af3cli ccd <filename>
```
Add custom CCD mmCIF content.

### bond
```bash
af3cli bond --add "A:1:C-B:1:O"
```
Format: `ENTITY_ID:RESIDUE_ID:ATOM_NAME-ENTITY_ID:RESIDUE_ID:ATOM_NAME`

### merge
```bash
af3cli merge <filename> - protein add "..."
```
- `--noreset`: Keep existing IDs
- `--userccd`: Override user CCD data
- `--bonds`: Merge bonded atoms
- `--seeds`: Merge seeds (removes duplicates)

### debug
```bash
af3cli debug --show -
```
Print final JSON to stdout without writing file.
