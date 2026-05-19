# af3cli Python API Reference

## InputBuilder

```python
from af3cli import InputBuilder

builder = InputBuilder()           # empty builder
builder = InputBuilder(existing)   # from existing InputFile
```

### Methods

| Method | Description |
|--------|-------------|
| `set_name(name: str)` | Job name |
| `set_version(version: int)` | AlphaFold3 version (1-3+). Auto-excludes description field for <= 3 |
| `set_dialect(dialect: str)` | Default: `"alphafold3"` |
| `set_seeds(seeds: list[int])` | Set random seeds (at least 1 required) |
| `add_sequence(seq: Sequence)` | Add protein/DNA/RNA sequence |
| `add_ligand(lig: Ligand)` | Add ligand/ion |
| `add_bonded_atom_pair(bond: Bond)` | Add bonded atom pair |
| `add_user_ccd(content: str)` | Set user-provided CCD mmCIF content |
| `build() -> InputFile` | Build the InputFile object |
| `merge(other: InputFile, ...)` | Merge with another InputFile |

## Sequence Types

```python
from af3cli import ProteinSequence, DNASequence, RNASequence
from af3cli.sequence import fasta2seq, read_fasta
```

### ProteinSequence(sequence, id=None, num=None, modifications=None, templates=None, msa=None, description=None)
- `id`: list of chain IDs, e.g. `["A", "B"]`
- `num`: copy number for homomultimers
- `modifications`: list of `ResidueModification`
- `templates`: list of `Template`
- `msa`: `MSA` object
- `description`: optional text comment (auto-excluded for AF v<=3)

### DNASequence / RNASequence
Same as ProteinSequence but with `NucleotideModification` instead of `ResidueModification`.

`DNASequence.reverse_complement()` - returns reverse complementary strand (without modifications/IDs).

### FASTA Import
```python
for seq in fasta2seq(filename):   # yields Sequence objects
    builder.add_sequence(seq)

for fasta_id, seq_str in read_fasta(filename):  # yields raw tuples
    print(fasta_id, seq_str)
```

## Modifications

```python
from af3cli import ResidueModification, NucleotideModification

rmod = ResidueModification("SEP", 5)      # CCD: SEP at position 5
nmod = NucleotideModification("6OG", 1)   # for DNA/RNA
```

## Templates

```python
from af3cli import Template, TemplateType

t = Template(TemplateType.STRING, "mmCIF content", qidx=[], tidx=[])
# or TemplateType.FILE for file paths

protein_seq = ProteinSequence("...", templates=[t])
```

## MSA

```python
from af3cli import MSA

msa = MSA(paired="content/path", unpaired="content/path",
          paired_is_path=True, unpaired_is_path=True)

protein_seq = ProteinSequence("...", msa=msa)
```

## Ligands

```python
from af3cli import Ligand, LigandType, SMILigand, CCDLigand
from af3cli.ligand import sdf2smiles

# Via base class
lig = Ligand(LigandType.SMILES, "CCC", id=["A"], num=2, description="propane")

# Via child class (preferred)
lig = SMILigand("CCC", id=["A"], num=2, description="propane")
lig = CCDLigand(["MG"], description="magnesium")

# From SDF
for smi in sdf2smiles("ligands.sdf"):
    builder.add_ligand(SMILigand(smi))

# ID: SDF with multiple entries → each entry gets auto-ID
# ID + num: can specify both, IDs take priority
```

## Bonds

```python
from af3cli import Bond, Atom

# From string format "E:R:N-E:R:N"
bond = Bond.from_string("A:1:C-B:1:O")

# From Atom objects
atom1 = Atom("A", 1, "C")
atom2 = Atom("B", 1, "O")
bond = Bond(atom1, atom2)

builder.add_bonded_atom_pair(bond)
```

## InputFile

```python
from af3cli import InputFile

input_file = InputFile()
input_file.write("filename.json")

# Read existing
existing = InputFile.read("filename.json")

# Merge
input_file.merge(other, reset=True, seeds=True, bonded_atoms=False, userccd=False)
```

## ID Handling

IDs auto-assigned by `IDRegister` when file is written. Manual override:

```python
prot = ProteinSequence("MVKLAGST...", id=["A", "B"])  # explicit chain IDs
prot = ProteinSequence("MVKLAGST...", num=2)           # or copy count
```

If both `id` and `num` are set, `id` takes priority. Missing IDs filled automatically.
