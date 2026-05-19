# alphafold3-skills

Agent skills for working with AlphaFold 3 — from building input JSON files to running and interpreting the structure prediction pipeline.

Two independent skills compatible with all tools supporting the [Agent Skills](https://agentskills.io) standard: opencode, Claude Code, Codex, Cursor, Gemini CLI, GitHub Copilot, Windsurf, and 50+ others.

## Skills

### af3cli

CLI and Python library for generating AlphaFold 3 input JSON files.

- Add protein / DNA / RNA sequences from FASTA or inline
- Add ligands from SMILES, CCD codes, or SDF files
- Configure bonds, modifications, templates, MSA data
- Chain commands pipeline-style

### alphafold3

Run and interpret AlphaFold 3 inference.

- Docker / Singularity run commands
- Input JSON format reference
- Output interpretation (pLDDT, PAE, pTM, ipTM, ranking)
- Performance tuning (compilation buckets, sharded databases, JAX cache)
- Troubleshooting common issues
- Model architecture and data pipeline internals
- Source code navigation guide

## Install

### skills CLI (recommended)

```bash
npx skills add ByteTora/alphafold3-skills    # npm
bunx skills add ByteTora/alphafold3-skills   # bun
pnpm dlx skills add ByteTora/alphafold3-skills # pnpm
```

The `skills` CLI automatically detects which agent tools are installed on your system and installs to the correct directories. Supports 55+ agents.

### gh CLI

```bash
gh skill install ByteTora/alphafold3-skills
```

Requires GitHub CLI v2.90.0+.

### Manual

```bash
git clone https://github.com/ByteTora/alphafold3-skills.git
# Copy to your agent's skills directory, e.g.:
cp -r alphafold3-skills/skills/* ~/.opencode/skills/
cp -r alphafold3-skills/skills/* ~/.claude/skills/
cp -r alphafold3-skills/skills/* ~/.codex/skills/
```

## Usage Examples

After installing, the skills trigger automatically when you mention relevant tasks.

### Build an AlphaFold 3 input file

```
"Create an AlphaFold3 input for myoglobin with a heme ligand"

→ Claude uses af3cli skill to generate the JSON
```

### Run structure prediction

```
"Run AlphaFold3 on this input file on my GPU server at 192.168.1.100"

→ Claude uses alphafold3 skill, SSH'es to the server and runs the docker command
```

### Interpret results

```
"What does an ipTM of 0.85 mean for my predicted complex?"

→ Claude uses alphafold3 skill to explain confidence metrics
```

## Remote Servers

Both skills support running on remote servers. Include the server address in your prompt:

```
"Fold this protein on my lab server (user@10.0.0.5)"
```

The alphafold3 skill will automatically prefix commands with `ssh user@host`.

## Dependencies

The skills themselves are documentation — no runtime dependencies. However, the tools they guide you to use require:

- **af3cli skill**: Python 3.10+, `pip install af3cli[biopython,rdkit]`
- **alphafold3 skill**: Docker, NVIDIA GPU (A100/H100), ~630 GB genetic databases, AlphaFold 3 model parameters

## License

MIT
