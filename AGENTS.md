# Agent Instructions

## Internal Documentation

This repository uses a **git submodule** for internal documentation:

- **Submodule path**: `internal-docs/`
- **Private repository**: `PatrickSys/codebase-context-mcp-internal`
- **Purpose**: Store internal research, strategies, and private development notes

### Initial Setup (New Machine)

When cloning this repository for the first time:

```bash
git clone https://github.com/PatrickSys/codebase-context-mcp.git
cd codebase-context-mcp
git submodule init
git submodule update
```

Or use the shorthand:

```bash
git clone --recurse-submodules https://github.com/PatrickSys/codebase-context-mcp.git
```

### Authentication

The submodule repository is **private**. Ensure you have:
- A valid GitHub Personal Access Token (PAT) with `repo` scope, OR
- SSH keys configured for GitHub access

### Syncing Changes

To pull latest changes from both main and submodule repositories:

```bash
git pull
git submodule update --remote
```

To commit changes in the submodule:

```bash
cd internal-docs
git add .
git commit -m "your message"
git push origin main
cd ..
git add internal-docs
git commit -m "Update submodule reference"
```

### Why a Submodule?

- **Privacy**: Keeps internal docs in a separate private repository
- **Sync**: Enables synchronization across multiple machines
- **Version Control**: Tracks internal docs alongside public code
- **Security**: CrowdStrike restrictions prevent USB transfers; GitHub provides secure cloud sync
