# SSH Proxy Server

A standalone SSH proxy server that authenticates users via SSH public keys stored in the Lattice database.

## Setup

The SSH proxy server runs independently from the main Lattice application but connects to the same database.

### Prerequisites

1. Lattice database must be created and migrated (includes `ssh_keys` table)
2. Users must have SSH keys added via the Lattice web UI
3. Python 3.6+ with required dependencies

### Installation

```bash
# Install dependencies (from the main lattice directory)
pip install paramiko sqlalchemy

# Or if using the project's virtual environment
source .venv/bin/activate
```

### Configuration

The SSH proxy server uses environment variables for configuration:

- `DATABASE_URL`: Database connection string (default: `sqlite:///lattice.db`)

### Running the Server

```bash
# From the ssh_proxy_server directory
cd src/lattice/ssh_proxy_server
python main.py

# With debug logging
python main.py --log-level=DEBUG
```

## Usage

### Adding SSH Keys

1. Log into the Lattice web application
2. Go to User Profile (click your user avatar)
3. Navigate to the "SSH Keys" section
4. Add your SSH public key with a descriptive name

### Connecting via SSH

Use the following format to connect through the proxy:

```bash
ssh -p 2222 <cluster_name>/<username>@<proxy_server_host>
```

Example:
```bash
ssh -p 2222 Home/myuser@localhost
```

Where:
- `Home` is the target cluster/node name
- `myuser` can be any username (it's not used for authentication)
- `localhost` is where the SSH proxy server is running
- `2222` is the default proxy server port

### Authentication

- Authentication is done via SSH public key only (no passwords)
- The proxy server looks up your public key in the database
- Access control is based on your user permissions

## Troubleshooting

### Database Connection Issues

```bash
# Check if database exists and has the ssh_keys table
sqlite3 lattice.db ".tables"
sqlite3 lattice.db "SELECT COUNT(*) FROM ssh_keys;"
```

### SSH Key Not Found

1. Verify your SSH key is added in the web UI
2. Check that the key is marked as active
3. Ensure you're using the correct public key format

### Connection Refused

1. Verify the SSH proxy server is running
2. Check the port (default 2222) is not blocked
3. Look at server logs for detailed error messages

## Architecture

The SSH proxy server:
1. Listens for SSH connections on port 2222
2. Authenticates incoming connections using public keys from the database
3. Authorizes access based on user permissions
4. Creates a transparent bridge to the target SSH destination
5. Updates key usage timestamps in the database
