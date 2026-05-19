# Background Jobs

Long-running computational tasks must run in the background — otherwise they die when the SSH connection drops.

## Choosing the Right Tool

| Tool | Best for | Key advantage |
|------|----------|---------------|
| **screen** | Simple, universally available | Easy to use, pre-installed on most servers |
| **tmux** | Advanced session management | Split panes, scriptable, modern |
| **nohup** | One-shot fire-and-forget | No session management, simplest |
| **at / batch** | Scheduled one-time jobs | System-level scheduling |

---

## screen

### Start a detached session

```bash
# Start a named detached session running a command
ssh user@host "screen -dmS myjob bash -c 'docker run ... 2>&1 | tee /tmp/myjob.log'"

# Start a session for interactive work
ssh user@host "screen -S myjob"
```

### Manage sessions

```bash
# List all sessions
ssh user@host "screen -ls"

# Attach to a running session (interactive only)
screen -r myjob

# Kill a session
ssh user@host "screen -S myjob -X quit"

# Check if a session exists
ssh user@host "screen -ls | grep myjob && echo FOUND || echo NOT_FOUND"
```

### Screen command reference

| Command | Description |
|---------|-------------|
| `screen -dmS <name> <cmd>` | Start detached session running command |
| `screen -ls` | List sessions |
| `screen -r <name>` | Reattach to session |
| `screen -S <name> -X quit` | Kill session |
| `screen -S <name> -X hardcopy /tmp/screen.log` | Dump screen content to file |

---

## tmux

### Start a detached session

```bash
# Start a named detached session running a command
ssh user@host "tmux new-session -d -s myjob 'docker run ... 2>&1 | tee /tmp/myjob.log'"

# Start a session for interactive work
ssh user@host "tmux new-session -s myjob"
```

### Manage sessions

```bash
# List all sessions
ssh user@host "tmux ls"

# Attach to a running session (interactive only)
tmux attach -t myjob

# Kill a session
ssh user@host "tmux kill-session -t myjob"

# Capture pane output to stdout
ssh user@host "tmux capture-pane -t myjob -p -S -"
```

### tmux command reference

| Command | Description |
|---------|-------------|
| `tmux new-session -d -s <name> '<cmd>'` | Start detached session |
| `tmux ls` | List sessions |
| `tmux attach -t <name>` | Reattach to session |
| `tmux kill-session -t <name>` | Kill session |
| `tmux capture-pane -t <name> -p -S -` | Print full scrollback to stdout |
| `tmux send-keys -t <name> C-c` | Send Ctrl+C to session |

---

## nohup

Simple, no session management needed — best for fire-and-forget tasks:

```bash
# Run command in background, immune to hangups
ssh user@host "nohup docker run ... > /tmp/myjob.log 2>&1 &"

# The shell returns immediately. The command keeps running.
# Check if still running:
ssh user@host "pgrep -f 'docker run' && echo RUNNING || echo DONE"

# Check output:
ssh user@host "tail -20 /tmp/myjob.log"
```

### nohup behavior
- Output goes to `nohup.out` if no redirect specified
- Process continues running after SSH disconnects
- No way to reattach — use `tail` to view output, `pgrep` to check status
- Kill with: `ssh user@host "pkill -f 'docker run'"`

---

## Screen vs tmux vs nohup Decision Matrix

| Criteria | screen | tmux | nohup |
|----------|--------|------|-------|
| Pre-installed on most servers | ✅ | ❌ (may need install) | ✅ |
| Can reattach to view live output | ✅ | ✅ | ❌ |
| Can interact with running process | ✅ | ✅ | ❌ |
| Can send keys/commands programmatically | Limited | ✅ | ❌ |
| Simplest to use | ✅ | ❌ | ✅ |
| Best for fire-and-forget | ✅ | ❌ | ✅ |
| Best for interactive/debug tasks | ✅ | ✅ | ❌ |

**Recommendation for agent workflows:**
- **screen** — default recommendation (universally available, simple)
- **tmux** — if already installed and user prefers it
- **nohup** — simplest case, no interaction needed

---

## Log Management

Always capture output to a log file for progress monitoring:

```bash
# Tee to both stdout and log file
screen -dmS myjob bash -c 'docker run ... 2>&1 | tee /tmp/myjob.log'

# Log file only
screen -dmS myjob bash -c 'docker run ... > /tmp/myjob.log 2>&1'
```

Recommended log paths:
- `/tmp/<jobname>.log` — temporary logs
- `~/logs/<jobname>.log` — persistent logs
- `~/output/<jobname>.log` — alongside output files

---

## Stopping a Running Job

```bash
# Find the process
ssh user@host "pgrep -a docker"

# Kill gently (SIGTERM)
ssh user@host "pkill -15 -f 'docker run'"

# Kill forcefully (SIGKILL)
ssh user@host "pkill -9 -f 'docker run'"

# Kill tmux/screen session
ssh user@host "tmux kill-session -t myjob"
ssh user@host "screen -S myjob -X quit"
```
