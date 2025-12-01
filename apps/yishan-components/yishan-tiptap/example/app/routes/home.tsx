import type { Route } from "./+types/home";
// import { SimpleEditor } from "yishan-tiptap";

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
    <div>
      {/* <SimpleEditor /> */}
    </div>
  );
}
