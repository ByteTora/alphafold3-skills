---
name: remote-server
description: "Manage remote Linux servers via SSH. Use when the user wants to: connect to a remote server via SSH, configure SSH keys and ~/.ssh/config, transfer files with scp/rsync, run long-running background jobs with screen/tmux/nohup, monitor progress of remote tasks, or retrieve results from a remote server. Triggers on mentions of remote server, SSH, scp, rsync, screen, tmux, nohup, background jobs on a server, or connecting to GPU/compute servers."
---

# Remote Server

Connect to remote Linux servers, transfer files, and manage long-running background jobs for scientific computing and machine learning workloads.

## Prerequisites

- **SSH client** (`ssh`, `scp`) — pre-installed on macOS/Linux
- **rsync** — recommended for efficient file transfer
- **screen** or **tmux** — for persistent background sessions
- SSH access to the remote server (hostname/IP, username, authentication)

## Core Workflow

```
Local Machine                          Remote Server
     │                                      │
 ① SSH 连接 ────────────────────────────────▶
 ② 上传文件 (scp/rsync) ─────────────────────▶
 ③ 启动后台任务 (screen/tmux/nohup) ─────────▶
 ④ 告知用户预计完成时间，断开连接
     │                                      │  ... 任务运行中 ...
 ⑤ 用户稍后要求检查进度
     │  ssh <host> "ls /path/output/" ──────▶  检查输出文件
     │  结果已出 / 仍在运行                     │
 ⑥ scp <host>:/path/output/* ./ ────────────▶  下载结果
```

## Quick Reference

### SSH Connection

```bash
ssh user@host                              # Direct
ssh -i ~/.ssh/id_rsa user@host             # With key
ssh -o ConnectTimeout=5 user@host "uptime" # Test connection
```

See `references/ssh-connection.md` for config, key setup, and jump hosts.

### File Transfer

```bash
# Upload single file
scp input.json user@host:/path/to/dir/

# Upload directory (recursive)
scp -r data/ user@host:/path/to/dir/

# Efficient sync (skip unchanged files, resume partial transfers)
rsync -avzP input.json user@host:/path/to/dir/

# Write file content directly via SSH
ssh user@host "cat > /path/to/input.json" < input.json

# Download results
scp user@host:/path/to/output/*.cif ./
rsync -avzP user@host:/path/to/output/ ./output/
```

See `references/file-transfer.md` for details.

### Background Jobs

```bash
# screen — start detached session
ssh user@host "screen -dmS af3 bash -c 'docker run ... 2>&1 | tee /tmp/af3.log'"

# tmux — start detached session
ssh user@host "tmux new-session -d -s af3 'docker run ... 2>&1 | tee /tmp/af3.log'"

# nohup — simplest, no session management needed
ssh user@host "nohup docker run ... > /tmp/af3.log 2>&1 &"
```

See `references/background-jobs.md` for session management and reattachment.

### Progress Monitoring

```bash
# Check if job is still running
ssh user@host "pgrep -a docker"

# View recent log output
ssh user@host "tail -50 /tmp/af3.log"

# Check for output files (indicates completion)
ssh user@host "ls -la /path/to/output/*.cif 2>/dev/null && echo DONE || echo RUNNING"

# Check tmux/screen session status
ssh user@host "screen -ls"
ssh user@host "tmux ls"
```

See `references/progress-monitoring.md` for polling strategies and notifications.

## Agent Behavior Guidelines

1. **Connection**: Always test SSH connectivity first before attempting file transfer or execution
2. **File transfer**: Ask the user for the remote path; default suggestions for AF3: `~/.af_input/` for input, `~/.af_output/` for output
3. **Background jobs**: Always use screen/tmux/nohup — never run long tasks in foreground over SSH
4. **After launching**: Tell the user the estimated completion time and that they can ask to check progress later
5. **Progress check**: Use minimal SSH commands (check for output files, tail logs) rather than attaching to sessions
6. **Error handling**: If SSH fails, suggest checking connectivity, key permissions, and firewall rules before retrying

## References in This Skill

- `references/ssh-connection.md` — SSH config, key authentication, jump hosts, connection testing
- `references/file-transfer.md` — scp, rsync, sftp, direct file writing, downloading results
- `references/background-jobs.md` — screen, tmux, nohup, session management, log management
- `references/progress-monitoring.md` — Polling strategies, log inspection, completion detection, notifications
