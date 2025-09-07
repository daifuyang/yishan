import { defineConfig } from "tsup";

export default defineConfig({
  entry: ["index.ts"],
  format: ["cjs", "esm"],
  dts: true,
  splitting: false,
  sourcemap: true,
  clean: true,
  tsconfig: "tsconfig.build.json",  // 明确指定使用 tsconfig.build.json
  external: [
    "react",
    "react-dom",
    "clsx",
    "class-variance-authority",
    "tailwind-merge",
    "lucide-react",
  ],
});
