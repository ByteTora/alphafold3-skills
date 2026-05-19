# alphafold3-tools

Agent skills for working with AlphaFold 3 — from building input JSON files to running and interpreting the structure prediction pipeline.

Two independent skills that work with [opencode](https://opencode.ai), [Claude Code](https://docs.anthropic.com/en/docs/claude-code), and [Codex](https://github.com/openai/codex).

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

### npx (recommended)

```bash
npx alphafold3-tools
```

Auto-detects which agent tools are present and installs both skills.

### npm global

```bash
npm install -g alphafold3-tools
alphafold3-tools
```

### Target a specific agent

```bash
npx alphafold3-tools --opencode      # opencode only
npx alphafold3-tools --claude-code   # Claude Code only
npx alphafold3-tools --codex         # Codex only
npx alphafold3-tools --all           # all paths, force install
```

### Manual

```bash
git clone https://github.com/ByteTora/alphafold3-skills.git
cp -r alphafold3-tools/skills/* ~/.opencode/skills/   # opencode
# or
cp -r alphafold3-tools/skills/* ~/.claude/skills/     # Claude Code
# or
cp -r alphafold3-tools/skills/* ~/.codex/skills/       # Codex
```

### Symbolic link (auto-updates on git pull)

```bash
ln -s "$(pwd)/alphafold3-tools/skills/af3cli" ~/.opencode/skills/af3cli
ln -s "$(pwd)/alphafold3-tools/skills/alphafold3" ~/.opencode/skills/alphafold3
```

## Agent Tool Compatibility

| Tool | Skills directory | Status |
|------|-----------------|--------|
| opencode | `~/.opencode/skills/` | Supported |
| Claude Code | `~/.claude/skills/` | Supported |
| Codex | `~/.codex/skills/` | Supported |

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
