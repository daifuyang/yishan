#!/usr/bin/env node
import chokidar from "chokidar";
import { execSync } from "child_process";

const build = () => execSync("node scripts/build-css.js", { stdio: "inherit" });

chokidar.watch(["**/*.less"], { ignoreInitial: false }).on("all", build);

console.log("正在监听样式文件变化...");

build()
