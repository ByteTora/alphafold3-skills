# AlphaFold 3 Input Format Reference

Official docs: https://github.com/google-deepmind/alphafold3/blob/main/docs/input.md

## Top-level Structure

```json
{
  "name": "job_name",
  "modelSeeds": [1, 2],
  "sequences": [...],
  "bondedAtomPairs": [...],
  "userCCD": "...",
  "userCCDPath": "...",
  "dialect": "alphafold3",
  "version": 4
}
```

| Field | Required | Description |
|-------|----------|-------------|
| `name` | Yes | Sanitized for output filenames |
| `modelSeeds` | Yes | At least one integer seed. N seeds = N predictions |
| `sequences` | Yes | List of entities (protein/RNA/DNA/ligand). Each entity must have a unique ID |
| `bondedAtomPairs` | No | Covalent bonds between atoms (entity:residue:atom) |
| `userCCD` | No | Inline CCD mmCIF string for custom ligands |
| `userCCDPath` | No | Path to CCD mmCIF file (mutually exclusive with userCCD) |
| `dialect` | Yes | Must be `"alphafold3"` |
| `version` | Yes | `1`, `2`, `3`, or `4` |

### Version Features

- **1**: Initial AF3 format
- **2**: Added `unpairedMsaPath`, `pairedMsaPath`, `mmcifPath` (external files)
- **3**: Added `userCCDPath`
- **4**: Added `description` field on all entity types

## Entity Types

### Protein

```json
{
  "protein": {
    "id": ["A", "B"],
    "sequence": "PVLSCGEWQL",
    "modifications": [{"ptmType": "HY3", "ptmPosition": 1}],
    "description": "optional comment",
    "unpairedMsa": "...",
    "unpairedMsaPath": "...",
    "pairedMsa": "...",
    "pairedMsaPath": "...",
    "templates": [...]
  }
}
```

- `id`: single letter or list for homomultimers
- `modifications`: CCD code + 1-based position
- `unpairedMsa` / `pairedMsa`: A3M format string (first seq = query)
- `unpairedMsaPath` / `pairedMsaPath`: path to A3M file (mutually exclusive with inline)
- `templates`: see Templates section

MSA combinations:
| unpairedMsa | pairedMsa | Effect |
|-------------|-----------|--------|
| null | null | Auto-build both (recommended) |
| "..." | "" | Use custom unpaired, run paired-free |
| "" | "" | Completely MSA-free |
| "..." | "..." | Custom both (expert) |

### RNA

```json
{
  "rna": {
    "id": "A",
    "sequence": "AGCU",
    "modifications": [{"modificationType": "2MG", "basePosition": 1}],
    "description": "...",
    "unpairedMsa": "...",
    "unpairedMsaPath": "..."
  }
}
```

Sequence only accepts A, C, G, U.

### DNA

```json
{
  "dna": {
    "id": "C",
    "sequence": "GACCTCT",
    "modifications": [{"modificationType": "6OG", "basePosition": 1}],
    "description": "..."
  }
}
```

Sequence only accepts A, C, G, T.

### Ligand

Three ways to specify:

```json
{"ligand": {"id": "D", "ccdCodes": ["ATP"], "description": "..."}}
{"ligand": {"id": "E", "ccdCodes": ["NAG", "FUC"]}}
{"ligand": {"id": "F", "smiles": "CC(=O)OC1C[NH+]2CCC1CC2", "description": "..."}}
```

- `ccdCodes` and `smiles` are mutually exclusive per ligand
- `ccdCodes` supports bonds with named atoms; `smiles` does NOT
- Ions are ligands: `"ccdCodes": ["MG"]`
- For multi-copy: `"id": ["F", "G", "H"]`
- SMILES must be JSON-escaped (backslashes → `\\`)

#### Writing SMILES safely

```bash
jq -R . <<< 'CCC[C@@H](O)CC\C=C\C=C\C#CC#C\C=C\CO'
```
```python
import json; print(json.dumps(r'CCC[C@@H](O)CC\C=C\C=C\C#CC#C\C=C\CO'))
```

## Modifications

Standard CCD modification codes. Common examples:

| Code | Residue | Modification |
|------|---------|--------------|
| HY3 | Proline | Hydroxyproline |
| SEP | Serine | Phosphoserine |
| P1L | Proline | 4-hydroxyproline |
| 2MG | Guanine | 2-methylguanosine (RNA) |
| 5MC | Cytosine | 5-methylcytidine (RNA) |
| 6OG | Guanine | 6-O-methylguanine (DNA) |
| 6MA | Adenine | N6-methyladenine (DNA) |

## Templates (Protein Only)

```json
"templates": [{
  "mmcif": "...",
  "mmcifPath": "...",
  "queryIndices": [0, 1, 2, 4, 5, 6],
  "templateIndices": [0, 1, 2, 3, 4, 8]
}]
```

- mmCIF must contain exactly one chain
- Mapping is 0-based on both sides
- Unresolved residues in template must be accounted for in indices

## Bonds

```json
"bondedAtomPairs": [
  [["A", 145, "SG"], ["D", 1, "C04"]],
  [["G", 1, "O6"], ["G", 2, "C1"]]
]
```

Each bond = `[source_entity_id, source_residue_1based, source_atom_name]` → same for dest.

## User-provided CCD

For custom bonded ligands not in the PDB CCD. Required sections:

```
data_MY-LIG
#
_chem_comp.id MY-LIG
_chem_comp.name 'custom ligand name'
_chem_comp.type non-polymer
_chem_comp.formula 'C10 H6 O4'
_chem_comp.mon_nstd_parent_comp_id ?
_chem_comp.pdbx_synonyms ?
_chem_comp.formula_weight 190.152
#
loop_
_chem_comp_atom.comp_id
_chem_comp_atom.atom_id
_chem_comp_atom.type_symbol
_chem_comp_atom.charge
_chem_comp_atom.pdbx_leaving_atom_flag
_chem_comp_atom.pdbx_model_Cartn_x_ideal
_chem_comp_atom.pdbx_model_Cartn_y_ideal
_chem_comp_atom.pdbx_model_Cartn_z_ideal
...
#
loop_
_chem_comp_bond.atom_id_1
_chem_comp_bond.atom_id_2
_chem_comp_bond.value_order
_chem_comp_bond.pdbx_aromatic_flag
...
#
```

Used by the model if RDKit conformer generation fails.

## Complete Example

```json
{
  "name": "Hello fold",
  "modelSeeds": [10, 42],
  "sequences": [
    {"protein": {"id": "A", "sequence": "PVLSCGEWQL", "modifications": [{"ptmType": "HY3", "ptmPosition": 1}], "unpairedMsa": "...", "pairedMsa": ""}},
    {"protein": {"id": "B", "sequence": "RPACQLW", "templates": [{"mmcif": "...", "queryIndices": [0,1,2], "templateIndices": [0,2,5]}]}},
    {"dna": {"id": "C", "sequence": "GACCTCT"}},
    {"rna": {"id": "D", "sequence": "AGCU"}},
    {"ligand": {"id": ["E", "F"], "ccdCodes": ["ATP"]}},
    {"ligand": {"id": "G", "smiles": "CC(=O)OC1C[NH+]2CCC1CC2"}}
  ],
  "dialect": "alphafold3",
  "version": 4
}
```
