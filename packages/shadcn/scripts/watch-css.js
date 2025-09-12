#!/usr/bin/env node
import chokidar from "chokidar";
import { execSync } from "child_process";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const build = () => execSync("node scripts/build-css.js", { stdio: "inherit" });
build();

const watchPath = path.resolve(__dirname, "../assets");
console.log("watchPath", watchPath);

const watcher = chokidar.watch([watchPath], {
  ignored: (path, stats) => stats?.isFile() && !path.endsWith(".less"),
  ignoreInitial: false,
});

watcher.on("ready", () => {
  console.log("Initial scan complete. Watching paths:");
  console.log(watcher.getWatched()); // 看看到底监听了哪些路径
});

watcher.on("change", (path) => {
  console.log(`文件 ${path} 发生变化, 开始构建...`);
  try {
    build();
    console.log(`文件 ${path} 构建完成`);
  } catch (error) {
    console.log(`文件 ${path} 构建失败`, error);
  }
});
