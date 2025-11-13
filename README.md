# Nano Banana Image Generator

基于 MuleRun 平台的 AI 图像生成应用，使用 Nano Banana 模型生成高质量图像。

## 项目概述

- **前端**: React + TypeScript + Vite + Tailwind CSS + shadcn/ui
- **后端**: Cloudflare Workers + TypeScript
- **AI 模型**: Nano Banana (gemini-2.5-flash-image-preview)
- **计费**: MuleRun Creator Metering (自定义计费)

## 功能特性

- ✨ AI 图像生成：基于文本提示词生成高质量图像
- 🎨 提示词模板：内置多种风格模板（像素艺术、赛博朋克、水彩画等）
- 📜 生成历史：显示最近 10 次生成记录
- 💰 透明计费：实时显示消费的 Credits
- 🔒 安全鉴权：完整的 iframe signature 验证
- 📱 响应式设计：支持各种屏幕尺寸

## 本地开发

### 环境准备

确保已安装:
- Node.js 18+
- npm 或 pnpm

### 安装依赖

```bash
# 安装前端依赖
cd frontend
npm install

# 安装 Worker 依赖
cd ../worker
npm install
```

### 配置环境变量

在 `worker` 目录下创建 `.dev.vars` 文件（用于本地开发）:

```bash
# Worker 开发环境变量
AGENT_KEY=test-agent-key
MULERUN_API_KEY=your-mulerun-api-key
MULERUN_BASE_URL=https://api.mulerun.com
APP_NAME=nano-banana-generator
CREATOR_MULTIPLIER=1.0
```

### 启动开发服务器

**方式1：分别启动（推荐用于调试）**

```bash
# 终端 1: 启动 Worker (端口 8787)
cd worker
npm run dev

# 终端 2: 启动前端 (端口 3000)
cd frontend
npm run dev
```

**方式2：使用统一启动脚本（即将支持）**

```bash
# 从项目根目录
./scripts/start-dev.sh
```

### 访问应用

- 前端: http://localhost:3000
- Worker API: http://localhost:8787
- 健康检查: http://localhost:8787/api/health

### 开发说明

#### 测试模式

在本地开发时，如果 URL 中没有 MuleRun 平台的 iframe 参数，应用会自动进入测试模式，使用模拟的会话参数。这样可以方便地在本地测试所有功能。

#### API 端点

- `POST /api/generate` - 生成图像
  - 需要鉴权（iframe signature）
  - 请求体包含提示词和会话参数
  - 返回 Base64 编码的图像和计费信息

- `GET /api/health` - 健康检查
  - 无需鉴权
  - 返回服务状态

## 部署

### 生产部署流程

1. **部署 Worker**

```bash
cd worker

# 设置生产环境变量
npx wrangler secret put AGENT_KEY
npx wrangler secret put MULERUN_API_KEY
npx wrangler secret put MULERUN_BASE_URL
npx wrangler secret put APP_NAME
npx wrangler secret put CREATOR_MULTIPLIER

# 部署
npm run deploy
```

2. **部署前端**

```bash
cd frontend

# 构建
npm run build

# 部署到 Cloudflare Pages
npx wrangler pages deploy dist --project-name=nano-banana-web
```

3. **配置 MuleRun 平台**

- 在 MuleRun Creator Studio 创建新的 iframe Agent
- 填写前端 URL（Cloudflare Pages 地址）
- 配置 Agent 名称、Logo、描述
- 选择计费模式：Creator Metering
- 提交审核

### 环境变量说明

| 变量名 | 说明 | 示例值 |
|-------|------|--------|
| `AGENT_KEY` | MuleRun Agent Key（用于签名验证） | ak-xxx |
| `MULERUN_API_KEY` | MuleRun API Key（用于调用服务） | sk-xxx |
| `MULERUN_BASE_URL` | MuleRun API 基础 URL | https://api.mulerun.com |
| `APP_NAME` | 应用名称 | nano-banana-generator |
| `CREATOR_MULTIPLIER` | 计费倍数（可选，默认 1.0） | 1.5 |

## 项目结构

```
.
├── frontend/                 # 前端应用
│   ├── src/
│   │   ├── components/      # UI 组件
│   │   │   └── ui/         # shadcn/ui 组件
│   │   ├── types/          # TypeScript 类型定义
│   │   ├── utils/          # 工具函数和模板
│   │   ├── lib/            # 库配置
│   │   ├── App.tsx         # 主应用组件
│   │   ├── main.tsx        # 入口文件
│   │   └── index.css       # 全局样式
│   ├── public/             # 静态资源
│   ├── package.json
│   ├── vite.config.ts
│   ├── tailwind.config.js
│   └── tsconfig.json
│
├── worker/                   # Cloudflare Worker
│   ├── src/
│   │   ├── handlers/       # 请求处理器
│   │   │   └── generate.ts # 图像生成处理
│   │   ├── utils/          # 工具函数
│   │   │   ├── signature.ts # 签名验证
│   │   │   ├── nanoBanana.ts # Nano Banana API
│   │   │   └── metering.ts # 计费上报
│   │   ├── types/          # 类型定义
│   │   └── index.ts        # Worker 入口
│   ├── package.json
│   ├── wrangler.toml
│   └── tsconfig.json
│
├── DEVOPS_GUIDE.md           # 部署和运维指南
├── PROJECT_INITIALIZATION_GUIDE.md # 项目初始化指南
└── README.md                 # 本文件
```

## 开发指南

### 代码规范

- 使用 TypeScript 严格模式
- 遵循 ESLint 和 Prettier 配置
- 组件使用 shadcn/ui，避免重复造轮子
- 所有 API 调用必须包含错误处理

### 提交规范

```bash
feat: 新功能
fix: 修复 bug
docs: 文档更新
style: 代码格式调整
refactor: 重构
test: 测试相关
chore: 构建工具或辅助工具变动
```

## 常见问题

### 1. 本地开发时 Worker 无法连接？

确保 Worker 在 8787 端口运行，检查 `vite.config.ts` 中的 proxy 配置。

### 2. 图像生成失败？

- 检查 `MULERUN_API_KEY` 是否正确配置
- 确认账户有足够的 Credits
- 查看 Worker 日志：`npm run tail`

### 3. 签名验证失败？

- 确认 `AGENT_KEY` 配置正确
- 检查请求体是否包含所有必需的 iframe 参数
- 查看 Worker 日志中的签名计算过程

### 4. 计费上报失败？

- 确认使用的是 `AGENT_KEY` 而非 `MULERUN_API_KEY`
- 检查 `MULERUN_BASE_URL` 配置
- 计费失败不影响图像返回，查看日志排查原因

## 技术支持

- MuleRun 平台文档: https://mulerun.com/docs
- 问题反馈: [GitHub Issues]
- 技术交流: [Discord/论坛链接]

## 许可证

MIT License
