# Writing Bro 文档

> 基于 Claude Code 的 SEO 写作系统。三层架构：编排 → 执行 → 能力。

## 快速开始

- [[GETTING-STARTED]] — 从零开始：安装、初始化站点、写第一篇文章
- [[COMMANDS]] — 所有命令速查：每个命令做什么、什么时候用

## 架构与概念

- [[ARCHITECTURE]] — 三层架构、目录结构、知识飞轮
- [[CONCEPTS]] — 核心概念：Persona、知识库、双轨内容、E-E-A-T

## 配置参考

- [[CONFIG-REFERENCE]] — config.md 字段说明、E-E-A-T 字段、knowledge.md 配置

## 站点文档

各站点的具体配置和使用记录在 `sites/{site}/docs/` 下（`sites/` 不进 git，仅在本地存在）。

## 文件索引

```
docs/
├── INDEX.md              ← 本文件
├── GETTING-STARTED.md    ← 快速开始
├── COMMANDS.md           ← 命令速查
├── ARCHITECTURE.md       ← 架构文档
├── CONCEPTS.md           ← 核心概念
└── CONFIG-REFERENCE.md   ← 配置参考
```
