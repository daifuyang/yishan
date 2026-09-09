# @zerocmf/yishan-tiptap

A React rich-text editor component built with TipTap.

## Installation

Install the current development release:

```bash
pnpm add @zerocmf/yishan-tiptap@dev
```

## Usage

```tsx
import { FormEditor } from "@zerocmf/yishan-tiptap";
import "@zerocmf/yishan-tiptap/index.css";

export function ArticleEditor() {
  return <FormEditor onChange={(html) => console.log(html)} />;
}
```

`react` and `react-dom` are peer dependencies and must be provided by the host application.

## Releases

Development releases use the `dev` npm tag. Update to the newest development build with:

```bash
pnpm update @zerocmf/yishan-tiptap@dev
```

The package ships CJS, ESM, TypeScript declarations, and CSS. Source maps are intentionally excluded from release packages to keep installs small.
