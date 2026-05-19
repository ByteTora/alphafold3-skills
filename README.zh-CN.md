<p align="center">
  <picture>
    <source media="(prefers-color-scheme: dark)" srcset="https://capsule-render.vercel.app/api?type=waving&color=0:3b82f6,100:8b5cf6&height=180&section=header&text=alphafold3-skills&fontSize=54&fontAlignY=35&desc=AlphaFold%203%20Agent%20Skills&descAlignY=55&fontColor=ffffff&descColor=cbd5e1&descZh=AlphaFold%203%20Agent%20Skills">
    <img src="https://capsule-render.vercel.app/api?type=waving&color=0:3b82f6,100:8b5cf6&height=180&section=header&text=alphafold3-skills&fontSize=54&fontAlignY=35&desc=AlphaFold%203%20Agent%20Skills&descAlignY=55&fontColor=ffffff&descColor=475569" alt="alphafold3-skills">
  </picture>
</p>

<p align="center">
  <a href="https://agentskills.io"><img src="https://img.shields.io/badge/Agent_Skills-Compatible-3b82f6?style=flat-square" alt="Agent Skills"></a>
  <a href="#skills"><img src="https://img.shields.io/badge/skills-2-success?style=flat-square" alt="Skills"></a>
  <a href="LICENSE"><img src="https://img.shields.io/badge/license-MIT-green?style=flat-square" alt="License"></a>
  <a href="https://github.com/ByteTora/alphafold3-skills/stargazers"><img src="https://img.shields.io/github/stars/ByteTora/alphafold3-skills?style=flat-square" alt="Stars"></a>
</p>

<p align="center">
  <a href="README.md">English</a> | <a href="README.zh-CN.md">简体中文</a>
</p>

---

用于 **[AlphaFold 3](https://github.com/google-deepmind/alphafold3)**（Google DeepMind 的生物分子结构预测管线）的 Agent Skills，覆盖从构建输入 JSON 到运行推理和解读结果的完整流程。

基于 [af3cli](https://github.com/SLx64/af3cli) 库生成输入文件，依托官方 [AlphaFold 3](https://github.com/google-deepmind/alphafold3) 推理管线。

兼容所有支持 [Agent Skills](https://agentskills.io) 标准的工具：opencode、Claude Code、Codex、Cursor、Gemini CLI、GitHub Copilot、Windsurf 等 50+ 工具。

---

## Skills 概览

|  | 🧬 af3cli | 🔬 alphafold3 |
|---|-----------|---------------|
| **功能** | 生成输入 JSON 文件 | 运行推理 + 解读结果 |
| **输入** | FASTA · SMILES · SDF · CCD | Input JSON |
| **输出** | `.json` 文件 | `.cif` 结构 + 置信度评分 |
| **依赖** | `pip install af3cli` + RDKit/Biopython | Docker + NVIDIA GPU |
| **核心能力** | 链式 CLI · Python API · MSA · 模板 · 键合 · 修饰 | 置信度指标 · 性能调优 · 故障排查 · 模型内部 · 源码导航 |

### 🧬 af3cli

用于生成 AlphaFold 3 输入 JSON 文件的 CLI 和 Python 库。

> 基于 [SLx64/af3cli](https://github.com/SLx64/af3cli)

- **序列** — 从 FASTA 或行内添加蛋白质 / DNA / RNA，自动检测反向互补链
- **配体** — 从 SMILES、CCD 代码或 SDF 文件（RDKit）添加配体
- **修饰** — 在指定位置添加氨基酸和核苷酸修饰
- **模板与 MSA** — 结构模板（mmCIF）和 paired/unpaired MSA 数据
- **键合** — 定义链与配体之间的原子键合对
- **链式管道** — 使用 `-` 分隔符组合命令：`af3cli config ... - protein add ... - ligand add ... - debug --show`

### 🔬 alphafold3

运行和解读 AlphaFold 3 推理——从 Docker 命令到理解输出指标。

> 基于 [google-deepmind/alphafold3](https://github.com/google-deepmind/alphafold3)

- **运行** — Docker/Singularity 命令、分阶段管线（仅数据 / 仅推理）、批量处理
- **输入格式** — 完整的 JSON 参考：序列、配体、键合、修饰、MSA、模板
- **置信度指标** — pLDDT（每原子）、PAE（每对）、pTM（整体折叠）、ipTM（界面）、排名评分
- **性能调优** — 编译桶、分片遗传数据库（10-30 倍加速）、JAX 持久缓存、统一内存
- **故障排查** — V100 问题、SMILES 双字母原子、MSA 差异、RDKit 构象生成失败
- **内部机制** — Evoformer 主干、扩散头、置信度头、数据管线架构、完整源码导航

---

## 安装

### skills CLI（推荐）

```bash
npx skills add ByteTora/alphafold3-skills       # npm
bunx skills add ByteTora/alphafold3-skills      # bun
pnpm dlx skills add ByteTora/alphafold3-skills  # pnpm
```

`skills` CLI 会自动检测已安装的 agent 工具，并安装到 55+ 工具的正确目录中。

### gh CLI

```bash
gh skill install ByteTora/alphafold3-skills
```

需要 GitHub CLI v2.90.0+。

### 手动安装

```bash
git clone https://github.com/ByteTora/alphafold3-skills.git

# 复制到你的 agent skills 目录：
cp -r alphafold3-skills/skills/* ~/.opencode/skills/   # opencode
cp -r alphafold3-skills/skills/* ~/.claude/skills/     # Claude Code
cp -r alphafold3-skills/skills/* ~/.codex/skills/       # Codex
cp -r alphafold3-skills/skills/* ~/.cursor/skills/     # Cursor
```

---

## 使用示例

安装后，当你提及相关任务时 skills 会自动触发。

### 构建输入文件

```
"帮我创建一个包含肌红蛋白和血红素配体的 AlphaFold3 输入文件"
```

→ Claude 使用 **af3cli** 生成包含蛋白质序列、SMILES 配体和键合信息的 JSON。

### 运行预测

```
"在 192.168.1.100 的 GPU 服务器上运行 AlphaFold3 预测这个输入文件"
```

→ Claude 使用 **alphafold3** SSH 连接到服务器并执行 Docker 推理命令。

### 解读结果

```
"预测复合物的 ipTM 是 0.85，这说明什么？"
```

→ Claude 使用 **alphafold3** 解释：ipTM > 0.8 表示高置信度的界面预测。

### 调试失败

```
"AlphaFold3 输出了 -99 的 clash 分数，怎么修复？"
```

→ Claude 使用 **alphafold3** 识别 V100/XLA 不兼容问题，并建议 `XLA_FLAGS` 解决方案。

---

## 远程服务器

两个 skill 都支持在远程服务器上运行 AlphaFold 3。在提示词中包含服务器地址即可：

```
"帮我在实验室服务器上折叠这个蛋白质（user@10.0.0.5）"
```

alphafold3 skill 会自动在 Docker 命令前加上 `ssh user@host`。

---

## 依赖项

Skills 本身是文档，无运行时依赖。但它们引导你使用的工具需要：

| 依赖项 | 需要的 skill | 详情 |
|------------|-------------|---------|
| `pip install af3cli[biopython,rdkit]` | af3cli | Python 3.10+ |
| AlphaFold 3 Docker 镜像 | alphafold3 | `docker build -t alphafold3 -f docker/Dockerfile .` |
| NVIDIA GPU (A100/H100) | alphafold3 | Compute Capability >= 8.0 |
| 遗传数据库 | alphafold3 | 约 252 GB 下载，约 630 GB 解压 |
| 模型参数 | alphafold3 | 通过 [Google Form](https://forms.gle/svvpY4u2jsHEwWYS6) 获取 |

---

## 参与贡献

欢迎贡献！如果你想改进 skill 或添加新的 AlphaFold 3 相关 skill：

1. Fork 本仓库
2. 在 `skills/` 下添加或修改 skill
3. 确保每个 skill 有有效的 `SKILL.md` 及 YAML frontmatter（`name`、`description`）
4. 提交 PR

---

## Star History

<p align="center">
  <a href="https://star-history.com/#ByteTora/alphafold3-skills&Date">
    <picture>
      <source media="(prefers-color-scheme: dark)" srcset="https://api.star-history.com/svg?repos=ByteTora/alphafold3-skills&type=Date&theme=dark">
      <img src="https://api.star-history.com/svg?repos=ByteTora/alphafold3-skills&type=Date" alt="Star History Chart" width="600">
    </picture>
  </a>
</p>

---

## 参考项目

- [SLx64/af3cli](https://github.com/SLx64/af3cli) — AlphaFold 3 输入 JSON 生成工具
- [google-deepmind/alphafold3](https://github.com/google-deepmind/alphafold3) — AlphaFold 3 官方推理管线
- [vercel-labs/skills](https://github.com/vercel-labs/skills) — Agent Skills CLI 工具

---

<p align="center">
  <sub>用 🧬 为蛋白质折叠社区打造</sub>
</p>
