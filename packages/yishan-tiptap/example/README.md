# TipTap standalone example

This React Router application exercises the published ESM, declaration, and CSS exports of `@yishan/tiptap`. It is intentionally excluded from the repository workspace and installs the built local package through `file:..`, resolving its React peers from the example's dependencies.

Use the Node and pnpm versions specified by the repository. Build the editor first from the repository root:

```bash
pnpm --filter @yishan/tiptap typecheck
pnpm --filter @yishan/tiptap build
```

Then install and run the standalone example:

```bash
cd packages/yishan-tiptap/example
pnpm --ignore-workspace install --frozen-lockfile
pnpm --ignore-workspace typecheck
pnpm --ignore-workspace build
pnpm --ignore-workspace dev
```

Open `http://localhost:5173/form` to edit content. Run `pnpm --ignore-workspace start` to serve the production build.

The pnpm lockfile is canonical. The example's React versions are independent of the Admin and mini-program applications. The hoisted pnpm layout in `.npmrc` avoids Windows path limits in React Router's package imports.

After rebuilding the editor, refresh the example's installed copy with `pnpm --ignore-workspace install --frozen-lockfile --force`. If pnpm still retains a stale local copy, remove the example's `node_modules` and repeat the frozen install. Always finish the editor build before installing the example.

For Docker, build the editor first and use its package directory as the context: `docker build -f example/Dockerfile -t yishan-tiptap-example .` from `packages/yishan-tiptap`. The image also installs with the standalone pnpm lockfile.
