# Agent Instructions

## Internal Documentation

This repository uses a private git submodule for internal notes.

- **Path**: `internal-docs/`
- **Repo**: `https://github.com/PatrickSys/codebase-context-internal.git`

### Quick Setup

```bash
git clone --recurse-submodules https://github.com/PatrickSys/codebase-context.git
```

### Syncing

```bash
git pull --recurse-submodules
git submodule update --remote --merge
```

### Privacy & Security

The `internal-docs` repository is **Private**. It returns a 404 to unauthenticated users/APIs. Access requires a GitHub PAT or SSH keys with repository permissions.
