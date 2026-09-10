# Structure Synchronization Rule

This rule mandates automatic synchronization of `AGENTS.md` whenever the repository structure evolves.

## Trigger & Scope
- **Applies to:** Any file creation, deletion, renaming, or directory reorganization in the workspace (specifically within `src/`, `.agents/`, or root configuration files).

## Mandatory Rule
1. Whenever you introduce, remove, or restructure files (e.g., adding a new feature module under `src/modules/<feature>/`, adding a new utility in `src/utils/`, or modifying configuration paths):
   - You **MUST immediately inspect and update the directory structure tree in Section 2 of [`AGENTS.md`](../../AGENTS.md)**.
   - Ensure the tree accurately shows all active modules, utilities, and configuration files.
   - Do not leave generic placeholders (like `[feature]`) if concrete modules (like `receipt`) exist.
2. Verify that any links or runbooks referenced in `AGENTS.md` point to existing, valid paths.
