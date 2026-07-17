# Plugin Runtime (Step 2)

This folder provides a minimal runtime skeleton for plugin manifests under `src/plugins/modules/*`.

Current responsibilities:

- Define core runtime types for manifest, lifecycle state, and hooks.
- Validate manifest shape with a lightweight TypeScript checker.
- Keep plugin state in a registry and drive transitions with a lifecycle state machine.
- Provide a minimal hook bus with priority-based execution.
- Discover and load module manifests from a configurable modules directory.
- Persist plugin metadata and runtime state into database models.

Current integration in `src/app.ts` scans/registers manifests, updates runtime state,
and syncs persistence. Existing route/plugin autoload behavior is unchanged.

Persistence behavior:

- Primary path: write to `sys_plugin*` tables via the Drizzle-backed database client.
- Fallback path: if persistence fails, runtime degrades to in-memory state and logs warnings.

Planned next steps:

- Add richer manifest constraints and error reporting.
- Add runtime events around transitions and hook emissions.
- Connect runtime state to feature toggles and controlled module enable/disable.
