# @yishan/tiptap

A React rich-text editor component built with TipTap.

## Installation

After a development release is published, install it with:

```bash
pnpm add @yishan/tiptap@dev
```

## Usage

```tsx
import { FormEditor } from "@yishan/tiptap";
import "@yishan/tiptap/index.css";

export function ArticleEditor() {
  return <FormEditor onChange={(html) => console.log(html)} />;
}
```

`react` and `react-dom` are peer dependencies and must be provided by the host application.

The declared peer range (`>=16.8.0`) is retained for existing consumers; it is not a tested version matrix. The external tarball verifier has passed with React/ReactDOM 18.3.1 and 19.2.0 (ESM, CJS, CSS, strict TypeScript and a single React instance). Admin and the standalone example also exercise React 19. React 16/17 and every other version in the broad peer range remain unverified; the mobile React 18 build itself is not editor compatibility evidence.

TipTap and the other editor dependencies are bundled into the release outputs and are development dependencies of this package. Consumers only need to provide the React peers.

## Releases

Development releases use the `dev` npm tag. Update to the newest development build with:

```bash
pnpm update @yishan/tiptap@dev
```

The package ships CJS, ESM, TypeScript declarations, and CSS. Source maps are intentionally excluded from release packages to keep installs small.

## Local development

From the repository root, run `pnpm --filter @yishan/tiptap typecheck` and `pnpm --filter @yishan/tiptap build`. The strict TypeScript check covers all package source independently of Rollup.

Run `pnpm --filter @yishan/tiptap verify:package` to check the built distribution files. `pnpm pack` in this package invokes the existing `prepack` build and verification before creating a local tarball; it does not publish to npm. The root `pnpm verify:tiptap` checks a tarball in an independent consumer outside the workspace, separate from the example's `file:..` development install. It reuses prepack, installs exact React 18/19 versions with strict peers, and keeps temporary consumers outside the repository. Optionally pass `--output <new external directory>`; existing directories are refused. Version 0.0.1-dev.0 has not been published by this verification.

The standalone React Router example lives in `example/` and is excluded from the pnpm workspace. After building the package, follow [the example instructions](example/README.md) to install and run it.
