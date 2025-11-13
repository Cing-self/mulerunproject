# 🚀 项目自动初始化指南

<!-- AI_INSTRUCTION: 用于自动化项目初始化的完整指南。包括环境检查、工具安装、项目创建等全流程。本文档会被开发规则文档自动引用。 -->

## 🌐 项目与MuleRun平台的关系

**本项目是一个独立的Web应用，作为MuleRun平台中的一个Agent（应用）存在。**

- **项目类型**：Web应用（不是其他Agent类型，比如n8n工作流）
- **展示方式**：以iframe方式嵌入到MuleRun平台上
- **最终部署**：前端网页URL + 后端服务

### 鉴权体系

本项目实现两层鉴权机制：

#### 1. Iframe 内嵌鉴权（Signature验证）
MuleRun平台通过iframe嵌入网页时，会在URL中传递签名参数，用于验证请求的真实性：
- **算法**：HMAC-SHA256
- **密钥**：Agent Key（从MuleRun获取）
- **验证参数**：signature（在URL查询参数中）
- **详细实现**：见开发规则文档

#### 2. 鉴权参数传递架构（实际实现方案）
**前端参数提取 + 请求体拼接**

**实现流程：**
```
MuleRun平台 iframe URL参数
  ↓ (包含userId, agentId, time, nonce, origin, sessionId, signature)
https://your-domain.com?userId=xxx&sessionId=xxx&signature=xxx&...
  ↓ (前端提取参数)
JavaScript 从 window.location.search 提取所有参数
  ↓ (混入业务数据)
将参数与 prompt 等拼接到请求体中
  ↓ (发送请求)
fetch('/api/generate', {
  body: JSON.stringify({ prompt, userId, agentId, ..., signature })
})
  ↓ (Worker验证)
后端从请求体提取签名参数验证
  ↓
签名验证成功 → 处理业务请求
```

**前端实现示例：**
```typescript
import { useState, useEffect } from 'react';

function App() {
  const [urlParams, setUrlParams] = useState<Record<string, string | number>>({});

  // 从URL参数提取iframe参数
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const extractedParams: Record<string, string | number> = {};
    
    params.forEach((value, key) => {
      // time作为整数存储
      if (key === 'time' && value) {
        extractedParams[key] = parseInt(value);
      } else {
        extractedParams[key] = value;
      }
    });
    
    setUrlParams(extractedParams);
  }, []);

  // 发送请求时混入所有iframe参数
  const handleGenerate = async (prompt: string) => {
    const requestBody = {
      prompt: prompt.trim(),
      sessionId: urlParams.sessionId,
      ...urlParams  // 所有iframe参数（包括signature）
    };

    const response = await fetch('/api/generate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(requestBody)
    });

    const data = await response.json();
    // 处理响应...
  };

  return (
    // 页面内容
  );
}
```

**后端验证实现（Worker）：**
```typescript
// 验证签名
const signatureValid = await verifyRequestSignature(requestBody, env);
if (!signatureValid) {
  return new Response(JSON.stringify({
    success: false,
    error: '签名验证失败',
    errorCode: 'SIGNATURE_INVALID'
  }), { status: 401 });
}

// 签名验证通过，继续处理业务
```

**关键组件：**
1. **前端参数提取**：从 `window.location.search` 提取iframe参数
2. **请求体拼接**：将参数与prompt等一起放入JSON请求体
3. **后端验证**：Worker从请求体提取签名相关参数进行HMAC-SHA256验证

**签名验证的参数范围（6个）：**
- userId
- agentId
- time（必须为字符串）
- nonce
- origin
- sessionId

⚠️ **不包含prompt**（用户输入的动态内容）

#### 3. API 调用鉴权
后端Worker调用MuleRun API时，使用API密钥进行Bearer Token鉴权。

### 计费体系说明

项目采用 MuleRun 平台的 **Creator Metering 计费模式**，完全采用 **Custom Metering（自定义计费）** 方式，由 Creator 自主定义计费逻辑。

**Custom Metering（自定义计费）的特点：**

- 💸 **完全弟控总计费计算逻辑**：Creator 可根据自身需求顺便就计费模式（不限于按分钟或按步数）
- 🚀 **基于 Metering API 上报**：不盬通过 Metering Report API 教室报告实际使用成本
- 🙀 **支持幂等性**：通过唯一的 meteringId 防止重复计费
- 📄 **成本单位**：0.0001 credits 的增量

**Metering API 相关端点：**

- **Metering Report API**
  - 端点：`POST https://api.mulerun.com/sessions/metering`
  - 用途：报告会话的使用成本
  - 特性：支持幂等性（通过 meteringId 防止重复计费）、支持标记最终报告以终止会话

- **Metering Get Reports API**
  - 端点：`GET https://api.mulerun.com/sessions/metering/{sessionId}`
  - 用途：查询会话的使用成本和状态
  - 返回信息：会话状态、报告计数、是否收到最终报告等

**项目中的计费实现：**

项目中不应硬编码成本值，而应当根据实际的业务逻辑动态计算：

1. **根据业务逻辑计算成本**：根据实际 API 调用、计算时间、资源消耗等策计算成本
2. **通过 Metering API 上报**：调用 Metering Report API 上报实际成本
3. **使用幂等机制**：每个计费报告使用唯一的 meteringId，防止重复计费

**关键点：**
- ✅ 计费完全由 Creator 自主定义
- ✅ 不有预定义的「按分钟」或「按步数」说法
- ✅ 成本单位以 0.0001 credits 为最小增量
- ✅ 使用 Metering API 的幂等机制确保准确计费
- ✅ 支持完全灵活的自定义计费逻辑
- ✅ 详细文档见 [MuleRun Metering API](https://mulerun.com/docs/creator-guide/agent/iframe-agent-spec)

**参考文档**：详见 MuleRun 官方文档中的"Creator Metering"和"Metering APIs"部分

---

### 后端鉴权实现

项目采用 **iframe Signature 验证机制**，确保所有请求都来自 MuleRun 平台。

**完整的签名验证实现（`worker/src/utils/signature.ts`）：**

```typescript
import type { Env } from '../types/index'

/**
 * 验证 iframe Signature
 * @param requestBody 请求体（包含所有参数）
 * @param env 环境变量（含AGENT_KEY）
 * @returns 验证是否通过
 */
export async function verifyRequestSignature(
  requestBody: Record<string, any>,
  env: Env
): Promise<boolean> {
  try {
    // 1️⃣ 从请求体中提取签名
    const receivedSignature = requestBody.signature
    
    if (!receivedSignature) {
      console.warn('⚠️ 未找到 signature 参数')
      return false
    }

    // 2️⃣ 提取签名所需的6个参数（不包括prompt）
    const iframeParamNames = [
      'userId',
      'agentId', 
      'time',
      'nonce',
      'origin',
      'sessionId'
    ]
    
    const payloadParams: Record<string, any> = {}
    
    // 只提取这6个参数
    iframeParamNames.forEach(key => {
      if (requestBody[key] !== undefined) {
        payloadParams[key] = requestBody[key]
      }
    })
    
    // 3️⃣ time必须转为字符串（关键步骤！）
    if (payloadParams.time !== undefined && typeof payloadParams.time === 'number') {
      payloadParams.time = String(payloadParams.time)
    }

    // 4️⃣ 按键名字母顺序排序并序列化
    const sortedKeys = Object.keys(payloadParams).sort()
    const sortedObj = sortedKeys.reduce((acc, key) => {
      acc[key] = payloadParams[key]
      return acc
    }, {} as Record<string, any>)
    
    // 5️⃣ JSON序列化时移除所有空格（必须！）
    const sortedPayload = JSON.stringify(sortedObj)
      .replace(/: /g, ':')    // 移除冒号后的空格
      .replace(/, /g, ',')    // 移除逗号后的空格

    // 6️⃣ 使用AGENT_KEY和Web Crypto API计算HMAC-SHA256签名
    const encoder = new TextEncoder()
    const key = await crypto.subtle.importKey(
      'raw',
      encoder.encode(env.AGENT_KEY || ''),
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['sign']
    )
    
    const signature = await crypto.subtle.sign(
      'HMAC',
      key,
      encoder.encode(sortedPayload)
    )
    
    // 7️⃣ 将签名转换为十六进制字符串
    const expectedSignature = Array.from(new Uint8Array(signature))
      .map(b => b.toString(16).padStart(2, '0'))
      .join('')

    // 8️⃣ 对比签名
    const isValid = receivedSignature === expectedSignature

    if (!isValid) {
      console.warn('❌ iframe Signature 验证失败', { 
        received: receivedSignature,
        expected: expectedSignature
      })
    }

    return isValid
    
  } catch (error) {
    console.error('❌ 签名验证异常', error)
    return false
  }
}
```

**在请求处理中调用（`worker/src/handlers/generate.ts`）：**

```typescript
import { verifyRequestSignature } from '../utils/signature'
import type { Env } from '../types/index'

export async function handleGenerate(request: Request, env: Env): Promise<Response> {
  try {
    const requestBody = await request.json()
    
    // ✅ 验证签名（必须通过）
    const signatureValid = await verifyRequestSignature(requestBody, env)
    if (!signatureValid) {
      return new Response(JSON.stringify({
        success: false,
        error: '签名验证失败',
        errorCode: 'SIGNATURE_INVALID'
      }), {
        status: 401,
        headers: { 
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*'
        }
      })
    }
    
    // 签名通过，继续处理请求...
    // ...
  } catch (error) {
    // 错误处理
  }
}
```

**关键点检查清单：**
- ✅ 只提取6个参数（userId, agentId, time, nonce, origin, sessionId）
- ✅ 不包含 prompt
- ✅ 不包含 signature 本身
- ✅ time 已转换为字符串
- ✅ 按字母顺序排序
- ✅ JSON 序列化时没有任何空格
- ✅ 使用正确的 AGENT_KEY
- ✅ 使用 Web Crypto API（不是 Node.js crypto）
- ✅ 签名转换为小写十六进制字符串

## 🎯 初始化目标

从零开始创建完整的现代Web应用项目，包含：
- 前端：React 18 + TypeScript + Vite + Tailwind CSS + shadcn/ui
- 后端：Cloudflare Workers + TypeScript
- 工具：Git + npm + Wrangler CLI
- 配置：完整的开发环境配置

## 🔧 初始化前环境检查

AI必须按顺序检查和安装以下工具：

### 1. 检查Node.js安装
```bash
# 检查Node.js版本
node --version

# 如果未安装或版本过低 (< 18.0.0)，提示用户安装
if ! command -v node &> /dev/null; then
    echo "❌ Node.js未安装，请先安装Node.js"
    echo "📥 下载地址：https://nodejs.org/"
    echo "🔧 推荐安装Node.js 18+ LTS版本"
    exit 1
fi

NODE_VERSION=$(node -v | cut -d'v' -f2)
REQUIRED_VERSION="18.0.0"

if [ "$(printf '%s\n' "$REQUIRED_VERSION" "$NODE_VERSION" | sort -V | head -n1)" != "$REQUIRED_VERSION" ]; then
    echo "❌ Node.js版本过低 ($NODE_VERSION)，需要 >= $REQUIRED_VERSION"
    echo "📥 请升级Node.js：https://nodejs.org/"
    exit 1
fi

echo "✅ Node.js版本检查通过: $NODE_VERSION"
```

### 2. 检查npm安装
```bash
# 检查npm版本
npm --version

if ! command -v npm &> /dev/null; then
    echo "❌ npm未安装，请重新安装Node.js"
    exit 1
fi

echo "✅ npm版本检查通过: $(npm --version)"
```

### 3. 检查Git安装
```bash
# 检查Git安装
git --version

if ! command -v git &> /dev/null; then
    echo "❌ Git未安装，请先安装Git"
    echo "📥 下载地址：https://git-scm.com/"
    exit 1
fi

echo "✅ Git版本检查通过: $(git --version)"
```

### 4. 检查并安装Wrangler CLI
```bash
# 检查Wrangler安装
npx wrangler --version 2>/dev/null || echo "Wrangler未安装"

# 全局安装Wrangler CLI
echo "🔧 安装Wrangler CLI..."
npm install -g wrangler

# 验证安装
if command -v wrangler &> /dev/null; then
    echo "✅ Wrangler CLI安装成功: $(wrangler --version)"
else
    echo "❌ Wrangler CLI安装失败"
    exit 1
fi
```

### 5. 环境检查完成
```bash
echo "🎉 所有必需工具已准备就绪！"
echo "📋 工具清单："
echo "  - Node.js: $(node --version)"
echo "  - npm: $(npm --version)"
echo "  - Git: $(git --version)"
echo "  - Wrangler: $(wrangler --version)"
```

## 📁 项目初始化流程

**注意：本项目已经初始化，下列步骤仅供参考。如需添加新特性或改动项目结构，请参考下列步骤。**

### 已初始化的项目结构
```
project-root/
├── frontend/              # 前端应用（React + TypeScript）
├── worker/                # 后端服务（Cloudflare Worker）
├── .git/                 # Git仓库
├── .gitignore
├── README.md
├── GENERAL_DEVELOPMENT_RULES.md  # 开发规范
└── PROJECT_INITIALIZATION_GUIDE.md  # 初始化指南
```

### 如需从零开始初始化项目
下列是对原始初始化流程的说明。

### Step 1: 获取项目信息
AI必须询问用户以下信息：
```bash
echo "🚀 开始项目初始化..."
echo ""

# 获取项目名称
read -p "📝 请输入项目名称: " PROJECT_NAME
if [ -z "$PROJECT_NAME" ]; then
    echo "❌ 项目名称不能为空"
    exit 1
fi

# 获取项目描述
read -p "📄 请输入项目描述: " PROJECT_DESCRIPTION

# 获取作者信息
read -p "👤 请输入作者名称: " AUTHOR_NAME

echo "✅ 项目信息收集完成"
echo "  - 项目名称: $PROJECT_NAME"
echo "  - 项目描述: $PROJECT_DESCRIPTION"
echo "  - 作者: $AUTHOR_NAME"
echo ""
```

### Step 2: 创建项目目录
```bash
echo "📁 创建项目目录..."

# 创建项目根目录
mkdir -p "$PROJECT_NAME"
cd "$PROJECT_NAME"

echo "✅ 项目目录创建完成: $(pwd)"
```

### Step 3: 初始化Git仓库
```bash
echo "🔧 初始化Git仓库..."

# 初始化Git
git init

# 创建.gitignore文件
cat > .gitignore << 'EOF'
# Dependencies
node_modules/
*/node_modules/

# Build outputs
dist/
build/
*/dist/
*/build/

# Environment variables
.env
.env.local
.env.development.local
.env.test.local
.env.production.local

# IDE
.vscode/
.idea/
*.swp
*.swo

# OS
.DS_Store
Thumbs.db

# Logs
logs/
*.log
npm-debug.log*
yarn-debug.log*
yarn-error.log*

# Cloudflare
.wrangler/
wrangler.toml.bak

# TypeScript
*.tsbuildinfo
EOF

echo "✅ Git仓库初始化完成"
```

### Step 4: 创建前端项目
```bash
echo "⚛️ 创建前端项目..."

# 创建前端目录
mkdir -p frontend
cd frontend

# 使用Vite创建React+TypeScript项目
echo "📦 使用Vite创建React项目..."
npm create vite@latest . -- --template react-ts --overwrite

# 安装基础依赖
echo "📦 安装前端依赖..."
npm install

# 安装Tailwind CSS
echo "🎨 安装Tailwind CSS..."
npm install -D tailwindcss postcss autoprefixer
npx tailwindcss init -p

# 安装shadcn/ui基础依赖
echo "🧩 安装shadcn/ui基础依赖..."
npm install class-variance-authority clsx tailwind-merge lucide-react

# 初始化shadcn/ui (这会创建必要的配置)
npx shadcn-ui@latest init -d

echo "✅ 前端项目创建完成"
```

### Step 5: 配置Tailwind CSS
```bash
echo "⚙️ 配置Tailwind CSS..."

# 创建tailwind.config.js (Tailwind已自动生成，这里展示配置内容)
cat > tailwind.config.js << 'EOF'
/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        border: "hsl(var(--border))",
        input: "hsl(var(--input))",
        ring: "hsl(var(--ring))",
        background: "hsl(var(--background))",
        foreground: "hsl(var(--foreground))",
        primary: {
          DEFAULT: "hsl(var(--primary))",
          foreground: "hsl(var(--primary-foreground))",
        },
        secondary: {
          DEFAULT: "hsl(var(--secondary))",
          foreground: "hsl(var(--secondary-foreground))",
        },
        destructive: {
          DEFAULT: "hsl(var(--destructive))",
          foreground: "hsl(var(--destructive-foreground))",
        },
        muted: {
          DEFAULT: "hsl(var(--muted))",
          foreground: "hsl(var(--muted-foreground))",
        },
        accent: {
          DEFAULT: "hsl(var(--accent))",
          foreground: "hsl(var(--accent-foreground))",
        },
        popover: {
          DEFAULT: "hsl(var(--popover))",
          foreground: "hsl(var(--popover-foreground))",
        },
        card: {
          DEFAULT: "hsl(var(--card))",
          foreground: "hsl(var(--card-foreground))",
        },
      },
      borderRadius: {
        lg: "var(--radius)",
        md: "calc(var(--radius) - 2px)",
        sm: "calc(var(--radius) - 4px)",
      },
    },
  },
  plugins: [],
}
EOF

# 更新src/index.css
cat > src/index.css << 'EOF'
@tailwind base;
@tailwind components;
@tailwind utilities;

@layer base {
  :root {
    --background: 0 0% 100%;
    --foreground: 222.2 84% 4.9%;
    --card: 0 0% 100%;
    --card-foreground: 222.2 84% 4.9%;
    --popover: 0 0% 100%;
    --popover-foreground: 222.2 84% 4.9%;
    --primary: 222.2 47.4% 11.2%;
    --primary-foreground: 210 40% 98%;
    --secondary: 210 40% 96%;
    --secondary-foreground: 222.2 47.4% 11.2%;
    --muted: 210 40% 96%;
    --muted-foreground: 215.4 16.3% 46.9%;
    --accent: 210 40% 96%;
    --accent-foreground: 222.2 47.4% 11.2%;
    --destructive: 0 84.2% 60.2%;
    --destructive-foreground: 210 40% 98%;
    --border: 214.3 31.8% 91.4%;
    --input: 214.3 31.8% 91.4%;
    --ring: 222.2 84% 4.9%;
    --radius: 0.5rem;
  }

  .dark {
    --background: 222.2 84% 4.9%;
    --foreground: 210 40% 98%;
    --card: 222.2 84% 4.9%;
    --card-foreground: 210 40% 98%;
    --popover: 222.2 84% 4.9%;
    --popover-foreground: 210 40% 98%;
    --primary: 210 40% 98%;
    --primary-foreground: 222.2 47.4% 11.2%;
    --secondary: 217.2 32.6% 17.5%;
    --secondary-foreground: 210 40% 98%;
    --muted: 217.2 32.6% 17.5%;
    --muted-foreground: 215 20.2% 65.1%;
    --accent: 217.2 32.6% 17.5%;
    --accent-foreground: 210 40% 98%;
    --destructive: 0 62.8% 30.6%;
    --destructive-foreground: 210 40% 98%;
    --border: 217.2 32.6% 17.5%;
    --input: 217.2 32.6% 17.5%;
    --ring: 212.7 26.8% 83.9%;
  }
}

@layer base {
  * {
    @apply border-border;
  }
  body {
    @apply bg-background text-foreground;
  }
}
EOF

echo "✅ Tailwind CSS配置完成"
```

### Step 6: 配置前端项目
```bash
echo "⚙️ 配置前端项目..."

# 创建vite.config.ts
cat > vite.config.ts << 'EOF'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  server: {
    port: 3000,
    host: '0.0.0.0'
  }
})
EOF

# 返回项目根目录
cd ..

echo "✅ 前端项目配置完成"
```

### Step 7: 创建后端Worker项目
```bash
echo "☁️ 创建Cloudflare Worker项目..."

# 创建Worker目录
mkdir -p worker
cd worker

# 初始化Worker项目
npm init -y

# 安装Worker依赖
npm install -D @cloudflare/workers-types typescript wrangler

# 初始化Wrangler
echo "🔧 初始化Wrangler..."
echo "⚠️  即将打开浏览器进行Cloudflare登录..."
echo "请在浏览器中完成登录，然后返回终端继续"
echo ""

# 进行Wrangler登录
npx wrangler login

# 初始化Wrangler项目配置
echo "初始化Worker项目配置..."
npx wrangler init --yes

echo "✅ Worker项目创建完成"
echo "⚠️  请检查生成的 wrangler.toml 文件，确保账户信息正确"

# 返回项目根目录
cd ..
```

### Step 8: 配置环境变量
```bash
echo "🔑 配置环境变量..."

# 在Worker目录创建.env文件
cd worker
cat > .env << 'EOF'
# MuleRun平台配置
MULERUN_API_KEY=your_api_key_here
MULERUN_BASE_URL=https://api.mulerun.com
APP_NAME=xxxx
EOF

echo "✅ 环境变量文件创建完成"
echo "⚠️  请编辑 worker/.env 文件，填入实际的 MULERUN_API_KEY"

# 返回项目根目录
cd ..
```

### Step 9: 创建项目文档
```bash
echo "📚 创建项目文档..."

# 创建README.md
cat > README.md << EOF
# $PROJECT_NAME

$PROJECT_DESCRIPTION

## 🚀 快速开始

### 前端开发
\`\`\`bash
cd frontend
npm install
npm run dev
\`\`\`

### 后端开发
\`\`\`bash
cd worker
npm install
npx wrangler dev
\`\`\`

### 部署
\`\`\`bash
# 部署Worker
cd worker
npx wrangler deploy

# 构建前端
cd ../frontend
npm run build
\`\`\`

## 🛠 技术栈

### 前端技术栈
- **React 18 + TypeScript + Vite + Tailwind CSS + shadcn/ui**
- **部署**: Cloudflare Pages 或其他静态托管服务

### 后端技术栈
- **Cloudflare Workers + TypeScript**
- **鉴权**: 鉴权参数通过请求体传递（需进Worker验证）

### 关键架构组件
- **Wrangler CLI**: Workers部署工具
- **Git + npm**: 版本控制和依赖管理
- **请求体传递**: 将鉴权参数和业务数据混合到JSON请求体

### 🔑 鉴权参数传递实现
**前端直接从URL提取参数并拼接到API请求体中：**

**实现流程：**

1. **前端参数提取和请求发送**:
```typescript
import { useState, useEffect } from 'react';

function App() {
  const [urlParams, setUrlParams] = useState<Record<string, string | number>>({});

  // 从URL参数提取iframe参数
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const extractedParams: Record<string, string | number> = {};
    
    params.forEach((value, key) => {
      // time作为整数存储
      if (key === 'time' && value) {
        extractedParams[key] = parseInt(value);
      } else {
        extractedParams[key] = value;
      }
    });
    
    setUrlParams(extractedParams);
  }, []);

  // 发送请求时混入所有iframe参数到请求体
  const handleGenerate = async (prompt: string) => {
    const requestBody = {
      prompt: prompt.trim(),
      ...urlParams  // 所有iframe参数（包括signature）
    };

    const response = await fetch('/api/generate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(requestBody)
    });

    const data = await response.json();
    // 处理响应...
  };

  return (
    // 页面内容
  );
}
```

2. **Worker端签名验证**:
Worker从请求体中提取签名参数（userId, agentId, time, nonce, origin, sessionId）进行验证。详细实现见 GENERAL_DEVELOPMENT_RULES.md 第50-165行的完整签名验证代码。

**关键要点**:
- ✅ 参数通过JSON请求体传递，而非Headers
- ✅ 签名验证时，只使用6个标准参数（不包含prompt和signature本身）
- ✅ time参数需转换为字符串进行签名验证
- ✅ 签名验证失败返回401错误

**更多信息**:
详见 GENERAL_DEVELOPMENT_RULES.md 中的"Iframe Signature 验证"部分，了解完整的签名计算和验证算法。

## 👤 作者

$AUTHOR_NAME
EOF

echo "✅ 项目文档创建完成"
```

### Step 10: 初始化Git提交
```bash
echo "🔧 初始化Git提交..."

# 添加所有文件
git add .

# 首次提交
git commit -m "🚀 Initial commit: Project initialized with React + Cloudflare Workers

- Frontend: React 18 + TypeScript + Vite + Tailwind CSS + shadcn/ui
- Backend: Cloudflare Workers + TypeScript
- Tools: Wrangler CLI, Git configuration
- Project: $PROJECT_NAME

👤 Author: $AUTHOR_NAME"

echo "✅ 初始提交完成"
```

### Step 11: 项目初始化完成
```bash
echo ""
echo "🎉 项目初始化完成！"
echo ""
echo "📋 项目信息："
echo "  - 项目名称: $PROJECT_NAME"
echo "  - 项目路径: $(pwd)"
echo "  - 作者: $AUTHOR_NAME"
echo ""
echo "⚠️  重要配置步骤："
echo "  1. 编辑 worker/.env 文件"
echo "     - 填入实际的 MULERUN_API_KEY"
echo "     - 确保 MULERUN_BASE_URL 正确"
echo ""
echo "  2. 配置鉴权参数传递（关键！）"
echo "     - 从URL提取iframe参数到JavaScript"
echo "     - 在所有API调用中通过请求体传递这些参数"
echo "     - 参考'鉴权参数传递实现'部分的代码"
echo "     - 验证Worker能正确从请求体提取并验证签名"
echo ""
echo "  3. 在 frontend 目录根据需要添加 shadcn/ui 组件"
echo "     cd frontend"
echo "     npx shadcn-ui@latest add button  # 示例：添加Button组件"
echo ""
echo "🚀 下一步操作："
echo "  1. 智能启动开发环境："
echo "     - 创建 ./scripts/start-dev.sh 脚本（参考 DEVOPS_GUIDE.md）"
echo "     - 运行 ./scripts/start-dev.sh 启动前端和后端"
echo "  2. 手动启动（备选方案）："
echo "     - cd frontend && npm run dev    # 启动前端开发服务器"
echo "     - cd worker && npx wrangler dev # 启动Worker开发服务器"
echo "  3. 开始你的开发工作！"
echo ""
echo "📚 开发和管理文档："
echo "  - GENERAL_DEVELOPMENT_RULES.md - 开发规范和规则"
echo "  - DEVOPS_GUIDE.md - 部署和运维指南"
```

## ✅ 初始化验证清单

AI在完成初始化后必须验证以下内容：

### 环境工具检查：
- [ ] Node.js >= 18.0.0 已安装
- [ ] npm 已安装并可正常使用
- [ ] Git 已安装并初始化
- [ ] Wrangler CLI 已整合安装且已登录Cloudflare账户

### 项目结构检查：
- [ ] 项目根目录已创建
- [ ] Git仓库已初始化
- [ ] frontend/ 目录和Vite项目已创建
- [ ] worker/ 目录和Cloudflare Workers项目已创建
- [ ] package.json 文件存在于 frontend 和 worker 目录
- [ ] .gitignore 文件已创建

### 配置文件检查：
- [ ] tailwind.config.js 已配置
- [ ] vite.config.ts 已配置
- [ ] wrangler.toml 已创建且账户信息正确
- [ ] worker/.env 文件已创建且包含必要的环境变量
- [ ] 前端依赖已安装完成
- [ ] 后端依赖已安装完成

### shadcn/ui 配置检查：
- [ ] shadcn/ui 已初始化、配置正常
- [ ] frontend/components/ui 目录存在

### 🔑 鉴权参数传递配置检查（关键！）：
- [ ] 前端已实现从URL提取iframe参数
- [ ] API调用函数正确将所有鉴权参数混入请求体
- [ ] 前端代码支持跨域请求到Worker
- [ ] Worker能从请求体正确提取鉴权参数
- [ ] Worker签名验证逫辑正常工作
- [ ] 签名验证失败正常返回401错误

### 文档检查：
- [ ] README.md 已创建
- [ ] 首次Git提交已完成

### 验证命令：
```bash
# 推荐方式：使用智能启动脚本
./scripts/start-dev.sh

# 手动验证（备选方案）
# 验证前端项目
cd frontend && npm run dev

# 验证后端项目
cd ../worker && npx wrangler dev

# 验证shadcn/ui配置
cd ../frontend && ls components/ui/

# 检查环境变量
cd ../worker && cat .env
```

**详细的开发环境管理请参考：[DEVOPS_GUIDE.md](./DEVOPS_GUIDE.md)**

## 🔑 环境变量配置指南

初始化完成后，你需要配置以下环境变量：

### Worker 环境变量（worker/.env）
```bash
# MuleRun平台配置 - 你必须提供实际值
MULERUN_API_KEY=your_actual_api_key_here  # 你的MuleRun API密钥
MULERUN_BASE_URL=https://api.mulerun.com  # MuleRun API的基础URL
APP_NAME=xxxx  # 项目名称
```

### 配置步骤：
1. 打开 `worker/.env` 文件
2. 将 `MULERUN_API_KEY` 替换为你提供的实际API密钥
3. 确保 `MULERUN_BASE_URL` 正确
4. 保存文件

**重要：不要把 .env 文件提交到版本控制系统（它已经在 .gitignore 中）**

## 🔐 Wrangler 登录说明

在初始化 Worker 项目时，你会被要求进行 Cloudflare 登录：

1. 执行 `npx wrangler login` 后，浏览器会自动打开Cloudflare登录页面
2. 使用你的Cloudflare账户登录
3. 授予Wrangler必要的权限
4. 登录完成后，返回终端继续初始化

**之后就不需要再配置API密钥了，Wrangler会自动使用你的账户信息**

## 🧩 shadcn/ui 组件使用

初始化时已经安装了shadcn/ui的基础依赖，在开发时根据需要添加具体组件：

```bash
# 在 frontend 目录下执行，添加需要的组件
cd frontend
npx shadcn-ui@latest add button      # 添加Button组件
npx shadcn-ui@latest add input       # 添加Input组件
npx shadcn-ui@latest add card        # 添加Card组件
# 更多组件请参考 https://ui.shadcn.com
```

## 🚨 故障排除

### Node.js安装问题
```bash
# macOS使用Homebrew
brew install node

# Ubuntu/Debian
sudo apt update
sudo apt install nodejs npm

# Windows使用Chocolatey
choco install nodejs
```

### Wrangler CLI安装问题
```bash
# 清理npm缓存
npm cache clean --force

# 重新安装
npm install -g wrangler

# 验证安装
wrangler --version
```

### 权限问题
```bash
# macOS/Linux权限问题
sudo chown -R $(whoami) ~/.npm
sudo chown -R $(whoami) /usr/local/lib/node_modules
```

### 网络问题
```bash
# 使用淘宝镜像
npm config set registry https://registry.npmmirror.com

# 临时使用
npm install --registry https://registry.npmmirror.com
```

如果以上所有检查都通过，项目初始化才算完成。如有任何检查失败，AI必须重新执行相应的初始化步骤。
