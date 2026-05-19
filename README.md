<p align="center">
  <picture>
    <source media="(prefers-color-scheme: dark)" srcset="https://capsule-render.vercel.app/api?type=waving&color=0:3b82f6,100:8b5cf6&height=180&section=header&text=alphafold3-skills&fontSize=54&fontAlignY=35&desc=Agent%20Skills%20for%20AlphaFold%203&descAlignY=55&fontColor=ffffff&descColor=cbd5e1">
    <img src="https://capsule-render.vercel.app/api?type=waving&color=0:3b82f6,100:8b5cf6&height=180&section=header&text=alphafold3-skills&fontSize=54&fontAlignY=35&desc=Agent%20Skills%20for%20AlphaFold%203&descAlignY=55&fontColor=ffffff&descColor=475569" alt="alphafold3-skills">
  </picture>
</p>

<p align="center">
  <a href="https://agentskills.io"><img src="https://img.shields.io/badge/Agent_Skills-Compatible-3b82f6?style=flat-square" alt="Agent Skills"></a>
  <a href="#skills"><img src="https://img.shields.io/badge/skills-2-success?style=flat-square" alt="Skills"></a>
  <a href="LICENSE"><img src="https://img.shields.io/badge/license-MIT-green?style=flat-square" alt="License"></a>
  <a href="https://github.com/ByteTora/alphafold3-skills/stargazers"><img src="https://img.shields.io/github/stars/ByteTora/alphafold3-skills?style=flat-square" alt="Stars"></a>
</p>

<p align="center">
  <a href="README.md">English</a> | <a href="README.zh-CN.md">简体中文</a>
</p>

---

Agent skills for working with **[AlphaFold 3](https://github.com/google-deepmind/alphafold3)** — Google DeepMind's biomolecular structure prediction pipeline — from building input JSON files to running and interpreting results.

Built on top of the [af3cli](https://github.com/SLx64/af3cli) library for input generation and the official [AlphaFold 3](https://github.com/google-deepmind/alphafold3) inference pipeline.

Compatible with all tools supporting the [Agent Skills](https://agentskills.io) standard: opencode, Claude Code, Codex, Cursor, Gemini CLI, GitHub Copilot, Windsurf, and 50+ others.

---

## Skills

|  | 🧬 af3cli | 🔬 alphafold3 |
|---|-----------|---------------|
| **What it does** | Generate input JSON files | Run inference + interpret results |
| **Input** | FASTA · SMILES · SDF · CCD | Input JSON |
| **Output** | `.json` file | `.cif` structure + confidence scores |
| **Dependencies** | `pip install af3cli` + RDKit/Biopython | Docker + NVIDIA GPU |
| **Key features** | Chainable CLI · Python API · MSA · Templates · Bonds · Modifications | Confidence metrics · Performance tuning · Troubleshooting · Model internals · Codebase navigation |

### 🧬 af3cli

CLI and Python library for generating AlphaFold 3 input JSON files.

> Based on [SLx64/af3cli](https://github.com/SLx64/af3cli)

- **Sequences** — Add protein / DNA / RNA from FASTA or inline, auto-detect reverse complement
- **Ligands** — Add from SMILES, CCD codes, or SDF files (RDKit)
- **Modifications** — Residue and nucleotide modifications at specified positions
- **Templates & MSA** — Structural templates (mmCIF) and paired/unpaired MSA data
- **Bonds** — Define bonded atom pairs between chains and ligands
- **Chainable pipeline** — Compose commands with `-` delimiter: `af3cli config ... - protein add ... - ligand add ... - debug --show`

### 🔬 alphafold3

Run and interpret AlphaFold 3 inference — from Docker commands to understanding output metrics.

> Based on [google-deepmind/alphafold3](https://github.com/google-deepmind/alphafold3)

- **Running** — Docker/Singularity commands, staged pipeline (data-only / inference-only), batch processing
- **Input format** — Complete JSON reference for sequences, ligands, bonds, modifications, MSA, templates
- **Confidence metrics** — pLDDT (per-atom), PAE (per-pair), pTM (overall fold), ipTM (interface), ranking scores
- **Performance tuning** — Compilation buckets, sharded genetic databases (10-30x speedup), JAX persistent cache, unified memory
- **Troubleshooting** — V100 issues, SMILES two-letter atoms, MSA discrepancies, RDKit conformer failures
- **Internals** — Evoformer trunk, Diffusion Head, Confidence Head, data pipeline architecture, full codebase map

---

## Install

### skills CLI (recommended)

```bash
npx skills add ByteTora/alphafold3-skills       # npm
bunx skills add ByteTora/alphafold3-skills      # bun
pnpm dlx skills add ByteTora/alphafold3-skills  # pnpm
```

The `skills` CLI automatically detects installed agent tools and installs to the correct directories for 55+ agents.

### gh CLI

```bash
gh skill install ByteTora/alphafold3-skills
```

Requires GitHub CLI v2.90.0+.

### Manual

```bash
git clone https://github.com/ByteTora/alphafold3-skills.git

# Copy to your agent's skills directory:
cp -r alphafold3-skills/skills/* ~/.opencode/skills/   # opencode
cp -r alphafold3-skills/skills/* ~/.claude/skills/     # Claude Code
cp -r alphafold3-skills/skills/* ~/.codex/skills/       # Codex
cp -r alphafold3-skills/skills/* ~/.cursor/skills/     # Cursor
```

---

## Usage Examples

After installing, the skills trigger automatically when you mention relevant tasks.

### Build an input file

```
"Create an AlphaFold3 input for myoglobin with a heme ligand"
```

→ Claude uses **af3cli** to generate the JSON with protein sequence, SMILES ligand, and bonds.

### Run prediction

```
"Run AlphaFold3 on this input file on my GPU server at 192.168.1.100"
```

→ Claude uses **alphafold3** to SSH into the server and run the Docker inference command.

### Interpret results

```
"What does an ipTM of 0.85 mean for my predicted complex?"
```

→ Claude uses **alphafold3** to explain: ipTM > 0.8 indicates high-confidence interface prediction.

### Debug failures

```
"AlphaFold3 produced a clash score of -99, how do I fix this?"
```

→ Claude uses **alphafold3** to identify the V100/XLA incompatibility and suggest `XLA_FLAGS` workaround.

---

## Remote Servers

Both skills support running AlphaFold 3 on remote servers. Include the server address in your prompt:

```
"Fold this protein on my lab server (user@10.0.0.5)"
```

The alphafold3 skill will automatically prefix Docker commands with `ssh user@host`.

---

## Dependencies

The skills themselves are documentation with no runtime dependencies. However, the tools they guide you to use require:

| Dependency | Required by | Details |
|------------|-------------|---------|
| `pip install af3cli[biopython,rdkit]` | af3cli | Python 3.10+ |
| AlphaFold 3 Docker image | alphafold3 | `docker build -t alphafold3 -f docker/Dockerfile .` |
| NVIDIA GPU (A100/H100) | alphafold3 | Compute Capability >= 8.0 |
| Genetic databases | alphafold3 | ~252 GB download, ~630 GB decompressed |
| Model parameters | alphafold3 | Via [Google Form](https://forms.gle/svvpY4u2jsHEwWYS6) |

---

## Contributing

Contributions are welcome! If you'd like to improve a skill or add new AlphaFold 3 related skills:

1. Fork the repo
2. Add or modify skills under `skills/`
3. Ensure each skill has a valid `SKILL.md` with YAML frontmatter (`name`, `description`)
4. Open a PR

---

## Star History

<p align="center">
  <a href="https://star-history.com/#ByteTora/alphafold3-skills&Date">
    <picture>
      <source media="(prefers-color-scheme: dark)" srcset="https://api.star-history.com/svg?repos=ByteTora/alphafold3-skills&type=Date&theme=dark">
      <img src="https://api.star-history.com/svg?repos=ByteTora/alphafold3-skills&type=Date" alt="Star History Chart" width="600">
    </picture>
  </a>
</p>

---

## References

- [SLx64/af3cli](https://github.com/SLx64/af3cli) — AlphaFold 3 input JSON generation tool
- [google-deepmind/alphafold3](https://github.com/google-deepmind/alphafold3) — Official AlphaFold 3 inference pipeline

---

