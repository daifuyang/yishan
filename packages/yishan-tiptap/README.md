# @yishan/tiptap

A React rich-text editor component built with TipTap.

## Installation

Install the current development release:

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

TipTap and the other editor dependencies are bundled into the release outputs and are development dependencies of this package. Consumers only need to provide the React peers.

## Releases

Development releases use the `dev` npm tag. Update to the newest development build with:

```bash
pnpm update @yishan/tiptap@dev
```

The package ships CJS, ESM, TypeScript declarations, and CSS. Source maps are intentionally excluded from release packages to keep installs small.

## Local development

From the repository root, run `pnpm --filter @yishan/tiptap typecheck` and `pnpm --filter @yishan/tiptap build`. The strict TypeScript check covers all package source independently of Rollup.

The standalone React Router example lives in `example/` and is excluded from the pnpm workspace. After building the package, follow [the example instructions](example/README.md) to install and run it.
