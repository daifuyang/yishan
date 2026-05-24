# Plugin Routes (Gradual Adoption)

This project supports a gradual plugin-route workflow for admin pages.

## Manifest format

Create files under `src/plugins/modules/*.manifest.ts` and export default object:

```ts
export default {
  name: 'plugin-name',
  version: '1.0.0',
  coreCompatibility: '^6.0.0',
  routes: [
    {
      path: '/example/path',
      component: './example/page',
      access: 'canDo',
    },
  ],
};
```

## Generate routes

Run:

```bash
pnpm --filter yishan-admin gen:plugin-routes
```

It generates `config/plugin-routes.generated.ts` and exports `pluginRoutes`.

## Compatibility rules

- Existing static routes in `config/routes.ts` are kept unchanged.
- Generated routes are appended before the 404 route.
- If a manifest route `path` already exists in static routes, it is skipped during generation.

This keeps current behavior stable while allowing incremental migration to plugin manifests.
