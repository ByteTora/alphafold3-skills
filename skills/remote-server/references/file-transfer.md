# File Transfer

## scp (Secure Copy)

Simplest tool for single files and directories:

### Upload

```bash
# Single file
scp input.json user@host:/path/to/dir/

# Rename on upload
scp input.json user@host:/path/to/dir/job_input.json

# Directory (recursive)
scp -r my_data/ user@host:/path/to/dir/

# With custom SSH key
scp -i ~/.ssh/af3_server input.json user@host:/path/
```

### Download

```bash
# Single file
scp user@host:/path/to/output/model.cif ./

# Directory
scp -r user@host:/path/to/output/ ./results/

# Specific file patterns
scp user@host:"/path/to/output/*.cif" ./
```

## rsync (Efficient Sync)

Preferred for large files and directories — skips unchanged files, resumes partial transfers:

```bash
# Upload (archive mode, compress, show progress)
rsync -avzP input.json user@host:/path/to/dir/

# Upload directory, skip existing files
rsync -avzP --ignore-existing data/ user@host:/path/to/dir/

# Download results
rsync -avzP user@host:/path/to/output/ ./results/

# Dry-run (see what would transfer without actually doing it)
rsync -avzP --dry-run user@host:/path/to/output/ ./results/

# Bandwidth limit (KB/s) — useful to not saturate network
rsync -avzP --bwlimit=50000 user@host:/path/to/output/ ./results/
```

### Key rsync flags

| Flag | Meaning |
|------|---------|
| `-a` | Archive mode (preserves permissions, timestamps, recursive) |
| `-v` | Verbose |
| `-z` | Compress during transfer |
| `-P` | Show progress + allow partial/resume |
| `--ignore-existing` | Skip files that already exist at destination |
| `--dry-run` | Preview without actually transferring |
| `--bwlimit=N` | Limit bandwidth to N KB/s |

## Direct File Writing via SSH

For small files, write content directly without scp/rsync:

```bash
# Write local file content directly to remote
ssh user@host "cat > /path/to/input.json" < input.json

# Write inline content
ssh user@host "cat > /path/to/script.sh" << 'EOF'
#!/bin/bash
echo "Hello from remote"
EOF

# Multi-line heredoc within agent workflow
ssh user@host bash -c "'cat > /path/to/input.json'" << 'ENDOFFILE'
{
  "name": "my_job",
  "modelSeeds": [1],
  ...
}
ENDOFFILE
```

## sftp (Interactive File Browser)

Useful for browsing remote directories before deciding what to download:

```bash
sftp user@host
# sftp> ls /path/to/output/
# sftp> get model.cif
# sftp> get -r output/
# sftp> exit
```

## Choosing the Right Tool

| Scenario | Tool |
|----------|------|
| Single small file, one-time | `scp` |
| Large files or directories | `rsync -avzP` |
| Resuming interrupted transfers | `rsync -avzP` |
| Writing config files inline | `ssh ... cat >` (direct write) |
| Browsing remote before downloading | `sftp` |

## Remote Directory Conventions

When the user hasn't specified remote paths, suggest these defaults for computational workloads:

| Purpose | Suggested Path |
|---------|---------------|
| Input files | `/home/user/data/input/` or `~/data/input/` |
| Output files | `/home/user/data/output/` or `~/data/output/` |
| Log files | `/home/user/logs/` or `/tmp/` |
| Temporary data | `/tmp/` |

Always confirm the path with the user before transferring.
