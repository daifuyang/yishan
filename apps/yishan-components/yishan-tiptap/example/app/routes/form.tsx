import type { Route } from "./+types/home";
import { FormEditor } from "yishan-tiptap";

export function meta({}: Route.MetaArgs) {
  return [
    { title: "React Router + Rollup Component Demo" },
    {
      name: "description",
      content: "Demo of React component built with Rollup",
    },
  ];
}

export default function Home() {
  return (
    <div style={{ width: 500, height: 500, border: "1px solid #000", display: "flex", alignItems: "center", justifyContent: "center", margin: '0 auto', overflow: 'auto' }}>
      <FormEditor />
    </div>
  );
}
