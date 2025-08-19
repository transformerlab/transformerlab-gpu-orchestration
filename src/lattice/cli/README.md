# Transformer Lab CLI

A beautiful command line interface for managing your Transformer Lab infrastructure.

## Installation

To install the CLI tool, run:

```bash
# Navigate to the backend directory
cd backend

# Install the CLI
pip install -e .
```

## Usage

After installation, you can use the `tlab` command:

### Authentication

```bash
# Login to your account
tlab login
```

### Managing Instances

```bash
# List all instances
tlab instances list

# Request a new instance
tlab instances request --name my-instance --instance-type gpu-a100 --region us-west-2

# SSH into an instance
tlab ssh my-instance
```

### Managing Node Pools

```bash
# List all node pools
tlab node-pools list
```

## Features

- Rich, colorful interface with tables and panels
- Interactive prompts and confirmations
- Progress indicators for long-running operations
- Clear error messages and help text
