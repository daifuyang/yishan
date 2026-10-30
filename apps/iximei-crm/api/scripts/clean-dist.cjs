/**
 * 编译前清空 dist。
 *
 * tsc 不会删除源码里已移除文件对应的产物，模块搬迁后那些 .js 会变成孤儿：
 * @fastify/autoload 扫的是 dist 目录，会把孤儿 index.js 再次注册成路由，
 * 于是同一份接口同时挂在新旧两个前缀下。清空后再编译可彻底避免。
 */
const { rmSync } = require('node:fs');
const { join } = require('node:path');

const dist = join(__dirname, '..', 'dist');
rmSync(dist, { recursive: true, force: true });
