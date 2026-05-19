# Progress Monitoring

Long-running remote tasks require non-blocking monitoring from the local agent.

## Quick Status Checks

### Is the job still running?

```bash
# Check by process name
ssh user@host "pgrep -a docker"

# Check by tmux/screen session
ssh user@host "screen -ls | grep myjob"
ssh user@host "tmux ls | grep myjob"

# Check by nohup process
ssh user@host "pgrep -f 'docker run'"
```

Returns a PID if running, empty if finished.

### View recent output

```bash
# Last 50 lines of log
ssh user@host "tail -50 /tmp/myjob.log"

# Follow log (interactive only, do NOT use in agent workflow)
# ssh user@host "tail -f /tmp/myjob.log"

# Search log for errors
ssh user@host "grep -i 'error\|fail\|exception' /tmp/myjob.log | tail -20"

# Search log for progress markers
ssh user@host "grep -i 'step\|epoch\|iter\|done\|complete' /tmp/myjob.log | tail -20"
```

## Completion Detection

### Check for output files

Most computational tools write output files when they finish:

```bash
# Check if expected output file exists
ssh user@host "ls -la /path/to/output/*.cif 2>/dev/null && echo DONE || echo RUNNING"

# Check modification time (was file recently written?)
ssh user@host "stat -c '%Y' /path/to/output/model.cif 2>/dev/null"

# Count output files
ssh user@host "ls /path/to/output/*.cif 2>/dev/null | wc -l"
```

### Check exit status from screen session

```bash
# screen stores exit code
ssh user@host "screen -ls | grep myjob"

# If session is not listed, the command has exited
# Check the log for success/failure
ssh user@host "tail -5 /tmp/myjob.log"
```

### Check tmux session status

```bash
# tmux session shows (attached) or (detached) if still running
ssh user@host "tmux ls 2>&1"

# If "no server running" or session not listed → command finished
```

## Polling Strategy

The agent should NOT continuously poll — instead, inform the user and wait for them to ask:

### Agent response after launching job

```
The job is running in the background on <host> (session: myjob).
Estimated completion: 4-6 hours.

You can check progress anytime by asking me, or I can check now
if you want to verify it started correctly.
```

### When user asks "check progress"

```bash
# 1. Is the job still running?
ssh user@host "screen -ls | grep myjob"

# 2. Check recent log output
ssh user@host "tail -30 /tmp/myjob.log"

# 3. Check for output files
ssh user@host "ls -la /path/to/output/ 2>/dev/null"
```

### When job is complete

```
The job has finished:
- Output files found at /path/to/output/
- Last log lines: [show tail output]

Would you like me to download the results?
```

## Downloading Results

### Download entire output directory

```bash
rsync -avzP user@host:/path/to/output/ ./results/
```

### Download specific files

```bash
scp user@host:"/path/to/output/*.cif" ./results/
scp user@host:"/path/to/output/*.json" ./results/
```

### Clean up remote files after download (optional)

```bash
# After confirming successful download
ssh user@host "rm -rf /path/to/output/"
ssh user@host "rm /tmp/myjob.log"
```

## Error Detection

### Check log for common failure patterns

```bash
ssh user@host "grep -i -E 'error|traceback|killed|out of memory|cuda|assert' /tmp/myjob.log | tail -20"
```

### Check resource exhaustion

```bash
ssh user@host "dmesg | tail -20 | grep -i 'killed\|oom'"
```

OOM killer messages indicate memory exhaustion — the process was killed by the system.

### Check GPU status

```bash
ssh user@host "nvidia-smi"
```

Look for:
- GPU utilization (should be >80% during active inference)
- Memory usage (should be close to GPU memory limit)
- Errors or Xid messages (indicate GPU hardware/driver issues)

## Notification (Advanced)

If the user wants automatic notification when a job finishes:

```bash
# Append a notification command after the main command
screen -dmS myjob bash -c 'docker run ... 2>&1 | tee /tmp/myjob.log; echo "JOB COMPLETE" | mail -s "AF3 Done" user@example.com'
```

Or with webhook:
```bash
screen -dmS myjob bash -c 'docker run ... 2>&1 | tee /tmp/myjob.log; curl -X POST https://hooks.slack.com/... -d "{\"text\":\"AF3 job completed\"}"'
```

The agent should not set these up automatically — ask the user if they want notification and what method.
