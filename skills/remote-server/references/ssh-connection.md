# SSH Connection

## Direct Connection

The simplest form of SSH connection:

```bash
ssh user@host                  # e.g., ssh root@192.168.1.100
ssh user@host -p 2222          # Custom port
ssh -v user@host               # Verbose — shows auth steps (debugging)
```

## Testing Connectivity

Before transferring files or running long jobs, verify the connection works:

```bash
# Quick connectivity test (5 second timeout)
ssh -o ConnectTimeout=5 -o BatchMode=yes user@host "echo connected"

# Check remote resources
ssh user@host "nvidia-smi"     # GPU status
ssh user@host "free -h"        # Memory
ssh user@host "df -h"          # Disk space
ssh user@host "uptime"         # System uptime
```

## SSH Key Authentication

Key-based auth is preferred for agent workflows (no password prompts):

### Generate a key (if you don't have one)

```bash
ssh-keygen -t ed25519 -C "alphafold3-server" -f ~/.ssh/af3_server
```

### Copy public key to server

```bash
ssh-copy-id -i ~/.ssh/af3_server.pub user@host
# Or manually:
cat ~/.ssh/af3_server.pub | ssh user@host "mkdir -p ~/.ssh && cat >> ~/.ssh/authorized_keys"
```

### Use the key

```bash
ssh -i ~/.ssh/af3_server user@host
scp -i ~/.ssh/af3_server file.txt user@host:/path/
```

### Key permissions

On the client side, the private key must have strict permissions:

```bash
chmod 600 ~/.ssh/af3_server
```

## SSH Config (~/.ssh/config)

Configure server aliases for convenience:

```
Host myserver
    HostName 192.168.1.100
    User root
    Port 22
    IdentityFile ~/.ssh/af3_server
    ServerAliveInterval 60
    ServerAliveCountMax 3
```

Then connect with just:

```bash
ssh myserver
scp file.txt myserver:/path/
```

The agent can guide the user to add a `Host` block to `~/.ssh/config`.

## Jump Hosts / Bastion Hosts

If the server is behind a firewall and requires a jump host:

```bash
# Direct jump
ssh -J jumpuser@jumphost targetuser@targethost

# Via config
# Host targethost
#     ProxyJump jumpuser@jumphost

# Multiple jumps
ssh -J user@jump1,user@jump2 finaluser@targethost
```

## Connection Troubleshooting

| Symptom | Check |
|---------|-------|
| Connection refused | Server SSH service running? Correct port? Firewall? |
| Permission denied (publickey) | Key properly added to `authorized_keys`? Key permissions correct? |
| Permission denied (password) | Password auth enabled on server? |
| Host key verification failed | Server re-imaged? Remove old key: `ssh-keygen -R host` |
| Connection timed out | Host reachable? `ping host`. VPN needed? |
| Broken pipe / connection reset | Add `ServerAliveInterval` to keep connection alive |

## Security Notes

- Always use SSH key authentication instead of passwords when possible
- Never hardcode passwords in commands or configs
- The private key (`~/.ssh/af3_server`) must stay on the local machine — never transfer it
- For shared servers, confirm the user has permission to access the compute resources
