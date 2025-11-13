---
trigger: always_on
alwaysApply: true
---
# 🚀 Web应用开发通用规则

<!-- AI_INSTRUCTION: 适用于简单Web应用开发的通用规则。如果项目尚未初始化，请参考 PROJECT_INITIALIZATION_GUIDE.md 进行项目初始化。 -->

## 🌐 平台集成要求

### Mulerun平台集成
**本项目是一个独立的Web应用，作为MuleRun平台中的一个Agent（应用）存在。**

#### 项目架构说明
MuleRun平台中的Agent可以是各种形态（如n8n工作流、独立网页应用等），本项目是基于现代Web技术开发的网页应用，通过iframe方式嵌入到MuleRun平台上。

**项目的最终形态：**
- 前端网页应用（React + TypeScript）
- 后端服务（Cloudflare Worker）
- 在MuleRun平台上以iframe方式展示网页URL

所有开发活动必须遵循以下要求：

#### 平台文档访问
- **Mulerun平台文档**：必须使用 `mulerun` MCP服务获取相关文档
- **API接口文档**：通过Mulerun MCP服务获取最新的API规范
- **平台集成指南**：参考Mulerun平台的官方集成文档

#### 🔍 MuleRun 文档查询制度（重要）
**对于任何不确定的平台相关问题，AI 一律优先使用MuleRun Docs MCP 查询**：

- ✅ **何时使用：**
  - 对于任何不确定的平台计费、API 规格、集成方式问题
  - 不知道是否存在某个功能或 API 端点
  - 需要验证平台第三方服务的接口规范

- 🔨 **使用方法：**
  - 使用 `mcp_mulerun-docs_SearchMuleRunDocs` 中文关键词查询
  - 例子：查询所有不确定的平台功能、API、计费模式等
  - 根据查询结果更新文档或代码实现

- 📨 **后续处理：**
  - 根据 MuleRun 官方文档的指引修改相关规范
  - 更新本文档或代码实现，确保与 MuleRun 官方一致

**例子：**
```typescript
// 不确定计费模式是否支持按时步？
// 不确定是否有新的会话管理 API？
// → 使用 mcp_mulerun-docs_SearchMuleRunDocs 查询计费、会话管理
// → 根据查询结果更新应用
```

#### 鉴权机制强制要求
**所有Cloudflare Worker接口必须实现多层鉴权：**

##### 1. Iframe Signature 验证（必须实现）

**工作原理：**
MuleRun 平台在生成 iframe URL 时，会计算一个 HMAC-SHA256 签名。前端加载时从 URL 参数中提取签名和其他参数，拼接到请求体中发送给后端。后端使用相同的算法重新计算签名进行验证。

**参数透传架构：**
```
MuleRun 平台 iframe URL
  ↓ (含有鉴权参数)
https://your-domain.com?userId=xxx&sessionId=xxx&...
  ↓ (前端提取参数)
JavaScript 从 window.location.search 提取
  ↓ (混入请求体)
fetch('/api/generate', {
  body: JSON.stringify({ prompt: ..., userId, agentId, ... })
})
  ↓ (Worker验证签名)
签名验证成功 → 处理请求
```

**完整的签名验证实现：**

```typescript
/**
 * 验证 iframe Signature
 * @param requestBody 请求体（包含所有参数）
 * @param env 环境变量（含AGENT_KEY）
 * @returns 验证是否通过
 */
async function verifyRequestSignature(
  requestBody: Record<string, any>,
  env: Env
): Promise<boolean> {
  try {
    // 1️⃣ 从请求体中提取签名
    const receivedSignature = requestBody.signature;
    
    if (!receivedSignature) {
      console.warn('⚠️ 未找到 signature 参数');
      return false;
    }

    // 2️⃣ 提取签名所需的6个参数（不包括prompt）
    const iframeParamNames = [
      'userId',
      'agentId', 
      'time',
      'nonce',
      'origin',
      'sessionId'
    ];
    
    const payloadParams: Record<string, any> = {};
    
    // 只提取这6个参数
    iframeParamNames.forEach(key => {
      if (requestBody[key] !== undefined) {
        payloadParams[key] = requestBody[key];
      }
    });
    
    // 3️⃣ time必须转为字符串（关键步骤！）
    if (payloadParams.time !== undefined && typeof payloadParams.time === 'number') {
      payloadParams.time = String(payloadParams.time);
    }

    // 4️⃣ 按键名字母顺序排序并序列化
    const sortedKeys = Object.keys(payloadParams).sort();
    const sortedObj = sortedKeys.reduce((acc, key) => {
      acc[key] = payloadParams[key];
      return acc;
    }, {} as Record<string, any>);
    
    // 5️⃣ JSON序列化时移除所有空格（必须！）
    const sortedPayload = JSON.stringify(sortedObj)
      .replace(/: /g, ':')    // 移除冒号后的空格
      .replace(/, /g, ',');   // 移除逗号后的空格

    // 6️⃣ 使用AGENT_KEY和Web Crypto API计算HMAC-SHA256签名
    const encoder = new TextEncoder();
    const key = await crypto.subtle.importKey(
      'raw',
      encoder.encode(env.AGENT_KEY || ''),
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['sign']
    );
    
    const signature = await crypto.subtle.sign(
      'HMAC',
      key,
      encoder.encode(sortedPayload)
    );
    
    // 7️⃣ 将签名转换为十六进制字符串
    const expectedSignature = Array.from(new Uint8Array(signature))
      .map(b => b.toString(16).padStart(2, '0'))
      .join('');

    // 8️⃣ 对比签名
    const isValid = receivedSignature === expectedSignature;

    if (!isValid) {
      console.warn('❌ iframe Signature 验证失败', { 
        received: receivedSignature,
        expected: expectedSignature
      });
    }

    return isValid;
    
  } catch (error) {
    console.error('❌ 签名验证异常', error);
    return false;
  }
}

// 在请求处理中调用
if (url.pathname === '/api/generate' && request.method === 'POST') {
  const requestBody = await request.json();
  
  // 验证签名（必须通过）
  const signatureValid = await verifyRequestSignature(requestBody, env);
  if (!signatureValid) {
    return new Response(JSON.stringify({
      success: false,
      error: '签名验证失败',
      errorCode: 'SIGNATURE_INVALID'
    }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' }
    });
  }
  
  // 签名通过，继续处理请求
  return await handleGenerateImage(requestBody, env);
}
```

**关键点检查清单：**
- [ ] 只提取6个参数（userId, agentId, time, nonce, origin, sessionId）
- [ ] 不包含 prompt
- [ ] 不包含 signature 本身
- [ ] time 已转换为字符串
- [ ] 按字母顺序排序
- [ ] JSON 序列化时没有任何空格
- [ ] 使用正确的 AGENT_KEY
- [ ] 使用 Web Crypto API（不是 Node.js crypto）
- [ ] 签名转换为小写十六进制字符串

##### 2. API Key Bearer Token 鉴权（用于平台API调用）
```typescript
// ✅ 强制使用Mulerun平台鉴权
const headers = {
  'Authorization': `Bearer ${env.MULERUN_API_KEY}`,
  'Content-Type': 'application/json'
};
```

**关键要求：**
- Signature验证失败返回 401 Unauthorized
- API Key验证失败返回 401 Unauthorized
- 所有敏感端点都必须验证鉴权
- Agent Key 绝不能暴露给客户端

#### API密钥管理
**严格的API密钥安全配置：**
- **环境变量配置**：所有API调用传递的API KEY必须配置到环境变量中
- **禁止硬编码**：代码中禁止出现任何硬编码的API密钥
- **密钥隔离**：不同环境的API密钥必须完全隔离

```typescript
// ✅ 正确的API密钥使用方式
const mulerunApiKey = env.MULERUN_API_KEY; // 从环境变量获取
const billingApiKey = env.MULERUN_BILLING_API_KEY; // 从环境变量获取

// ❌ 严格禁止的硬编码方式
const apiKey = 'sk-1234567890abcdef'; // 禁止！
```

#### 环境变量配置规范
**所有配置都存储在环境变量中：**
```bash
# Cloudflare Workers环境变量 - 所有必需配置
AGENT_KEY=your-mulerun-agent-key  # Mulerun平台提供的Agent Key，用于签名验证
MULERUN_API_KEY=sk-xxxxx  # MuleRun平台提供的API密钥，用于API调用
MULERUN_BASE_URL=https://api.mulerun.com  # MuleRun API调用的前缀URL
APP_NAME=xxxx  # 项目名称
```

#### API调用模式
**标准的Mulerun平台API调用要求：**
- 使用环境变量中的API密钥进行鉴权（Authorization: Bearer ${API_KEY}）
- `MULERUN_BASE_URL` 为API调用的前缀，具体端点需拼接完整路径
- 实现完整的错误处理机制
- 使用结构化的请求和响应格式

**API调用示例：**
```typescript
// Worker中调用MuleRun API
const baseUrl = env.MULERUN_BASE_URL; // https://api.mulerun.com
const endpoint = '/api/xxx'; // 具体的API端点
const fullUrl = baseUrl + endpoint; // https://api.mulerun.com/api/xxx

const response = await fetch(fullUrl, {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${env.MULERUN_API_KEY}`,
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({...})
});
```

#### 🔒 API安全调用架构
**前端禁止直接调用Mulerun平台服务：**

**架构强制要求：前端 → Worker → Mulerun平台**
```
前端网页 (浏览器)
    ↓ (调用自己的Worker接口)
Cloudflare Worker (后端)
    ↓ (持有API密钥，调用MuleRun API)
MuleRun 平台
```

**具体要求：**
- 前端只能调用自己部署在Cloudflare Workers上的接口
- Worker作为代理层，负责转发请求到MuleRun平台
- 所有MuleRun API密钥**只能**存储在Worker环境变量中
- 前端代码中**禁止出现**任何MuleRun API密钥

**安全要求：**
- API密钥保护：防止密钥暴露在浏览器中
- 访问控制：统一管理对外部服务的访问权限
- 日志监控：在Worker层实现请求日志和错误追踪
- 缓存优化：在代理层添加适当的缓存机制

**最终部署：**
- 前端网页部署到Cloudflare Pages静态托管服务
- Worker部署到Cloudflare Workers
- 将前端网页的URL提供给MuleRun平台，以iframe方式嵌入

## 💻 本地开发环境配置

**详细的本地开发环境管理请参考：[DEVOPS_GUIDE.md](./DEVOPS_GUIDE.md)**

### 核心要求
- 使用智能启动脚本管理开发环境
- 所有日志统一写入 `logs/` 目录
- 实现端口冲突自动检测和解决
- 支持一键启动和停止开发环境

### 日志收集机制
- Worker自动收集所有日志到内存
- 提供HTTP接口供前端查询
- 页面底部显示实时日志面板
- 支持按级别过滤、搜索、统计

**完整的端口管理、进程控制、日志收集实现请参考DevOps指南。**



### 项目状态检查
AI必须首先检查当前工作目录是否已初始化：

**检查项目结构是否存在：**
- 存在 `package.json` (根目录或前端目录)
- 存在 `src/` 或 `frontend/src/` 目录
- 存在 `worker/` 或 `backend/` 目录
- 存在 `.git` 目录

**如果项目未初始化，必须立即执行以下步骤：**
1. 停止当前开发任务
2. 跳转到 `PROJECT_INITIALIZATION_GUIDE.md` 文档
3. 按照该文档完整执行项目初始化
4. 初始化完成后，再返回当前任务

**如果项目已初始化，继续执行当前开发任务。**

## 🔧 技术栈要求

### 前端强制技术栈
**必须使用：**
- React 18+ with TypeScript
- Tailwind CSS (通过shadcn/ui)
- Vite (构建工具)
- Radix UI (无样式组件库)
- Lucide React (图标库)

**绝对禁止：**
- 任何其他UI框架 (Bootstrap, Material-UI等)
- 直接操作DOM的库 (jQuery等)
- CSS-in-JS库 (styled-components等)
- 自造UI组件轮子

### 后端强制技术栈
**必须使用：**
- Cloudflare Workers (Serverless Functions)
- TypeScript (严格模式)
- Wrangler (CLI工具)

## 🎨 UI组件强制使用规则

### shadcn/ui组件优先级
**必须优先使用shadcn/ui组件**

1. **最高优先级**：表单组件
   - Button, Input, Textarea, Select
   - Checkbox, RadioGroup, Switch

2. **高优先级**：布局组件
   - Card, Dialog, Tabs, Separator

3. **中优先级**：显示组件
   - Badge, Alert, Progress, Skeleton

4. **低优先级**：特殊组件
   - Table, Dropdown Menu, Tooltip

### 组件使用检查清单
在开发任何UI组件前，AI必须：
- [ ] 检查shadcn/ui是否已有对应组件
- [ ] 使用 `npx shadcn-ui@latest add [component-name]` 添加组件
- [ ] 禁止重复实现基础组件（Button、Card、Input等）

## 📁 文件组织规则

### 前端文件结构
```
frontend/
├── src/
│   ├── components/          # 通用组件
│   │   └── ui/             # shadcn/ui组件
│   ├── pages/             # 页面组件
│   ├── hooks/             # 自定义Hook
│   ├── utils/             # 工具函数
│   ├── types/             # 类型定义
│   ├── lib/               # 第三方库配置
│   ├── App.tsx            # 主应用组件
│   └── main.tsx           # 入口文件
├── public/                # 静态资源
├── package.json
├── vite.config.ts
└── tailwind.config.js
```

### 后端文件结构
```
worker/
├── src/
│   ├── index.ts           # Worker入口
│   ├── handlers/          # 请求处理器
│   ├── utils/             # 工具函数
│   └── types/             # 类型定义
├── package.json
├── wrangler.toml
└── tsconfig.json
```

## 🔌 API调用规则

### 前端API调用模式
**必须使用标准的fetch模式：**
- 使用fetch API进行HTTP请求
- 包含正确的请求头和Content-Type
- 实现响应状态检查和错误处理
- 添加加载状态和用户反馈

**错误处理要求：**
- 使用try-catch-finally结构处理异常
- 提供用户友好的错误提示信息
- 实现加载状态管理
- 记录详细的错误日志用于调试

### 后端API处理模式
**Cloudflare Worker标准处理流程：**
- 验证请求方法和路径
- 解析和验证请求数据
- 执行业务逻辑处理
- 调用外部API服务
- 返回标准化的响应格式
- 实现完整的错误处理和日志记录

## 🎛 状态管理规则

### React组件状态管理
**标准的useState模式要求：**
- 使用useState管理组件状态
- 包含loading、error、result等标准状态
- 实现表单验证和用户输入处理
- 添加完整的异步操作处理流程

## 🛡 错误处理规则

### 前端错误处理
**必须处理的错误场景：**
- 网络连接错误和超时
- API响应状态码错误
- 数据格式验证错误
- 用户输入验证错误

### 后端错误处理
**必须处理的错误场景：**
- HTTP请求方法验证
- 请求数据格式验证
- 外部API调用失败
- 内部服务器异常

## 🔒 安全规则

### 输入验证要求
**前端验证：**
- 检查必填字段和非空验证
- 限制输入长度和字符范围
- 过滤潜在的恶意内容
- 提供实时的用户反馈

**后端验证：**
- 验证请求体格式和类型
- 检查必需字段和数据范围
- 实现SQL注入和XSS防护
- 记录验证失败的详细信息

## 📊 日志规则

### 前端日志
**用户友好的日志要求：**
- 使用emoji和中文描述操作步骤
- 记录关键操作的开始和结束状态
- 显示数据预览和处理结果
- 提供详细的错误信息用于调试

### 后端日志
**结构化日志要求：**
- 使用统一的JSON格式记录日志
- 包含时间戳、日志级别和消息
- 记录请求处理的详细步骤
- 捕获和记录异常堆栈信息

## 🚀 部署规则

**完整的部署和运维流程请参考：[DEVOPS_GUIDE.md](./DEVOPS_GUIDE.md)**

### 部署流程概要
- 本地开发 → 预发布验证 → 生产部署
- 智能启动脚本管理端口和进程
- 所有日志写入结构化的logs目录
- 自动化部署和回滚策略

### 部署后检查清单
- [ ] 前端页面正常加载和渲染
- [ ] 所有API接口响应正常
- [ ] Mulerun平台API调用成功
- [ ] 计费上报功能正常工作
- [ ] 错误处理和用户反馈完整
- [ ] **Worker日志正常输出**（运行 `npx wrangler tail` 验证）
- [ ] **实时日志监控工作**（通过CLI或Dashboard）
- [ ] **日志级别配置正确**（INFO/WARN/ERROR级别适当）
- [ ] **错误日志有详细信息**（包含堆栈和上下文）
- [ ] 性能指标符合预期
- [ ] 所有日志文件正确写入到logs目录

## ✅ 开发检查清单

### 代码提交前检查
- [ ] 使用了正确的技术栈（React + TypeScript + Vite）
- [ ] 优先使用shadcn/ui组件，没有重复造轮子
- [ ] 包含完整的错误处理
- [ ] 实现了输入验证
- [ ] 添加了用户友好的日志
- [ ] 包含加载状态和错误提示
- [ ] 代码结构清晰，易于理解

### 功能测试检查
- [ ] 前端页面正常渲染
- [ ] 表单提交功能正常
- [ ] 错误情况有适当提示
- [ ] 后端API响应正确
- [ ] 网络错误有处理
- [ ] 加载状态显示正常

### 部署前检查
- [ ] 环境变量配置正确
- [ ] API端点配置正确
- [ ] 构建无错误和警告
- [ ] 本地测试通过
- [ ] 性能优化合理

## 🎯 开发最佳实践

### 用户体验
- 提供清晰的加载状态
- 友好的错误提示信息
- 响应式设计支持
- 键盘快捷键支持

### 代码质量
- 使用TypeScript严格模式
- 组件职责单一
- 函数命名清晰
- 添加适当的注释

### 性能优化
- 避免不必要的重渲染
- 使用React.memo优化组件
- 图片和资源优化
- 代码分割和懒加载

## 🚨 常见错误和解决方案

### 组件报错

**点攻策略：**

#### 1. import type 缺失错误
```
TypeScript 错误: "X" 是一种类型，但用在值的位置
```

**解决：**
在导入类型时程序中使用 `import type`：
```typescript
// ✅ 正確方式
import type { MyType } from '@/types';

// ❌ 错误方式
import { MyType } from '@/types';
```

#### 2. 路径别名解析失败
Symbol not found 或 Module not found

**解决：**
显式指定 `/index` 后缀：
```typescript
// ✅ 推荐
import type { Type } from '@/types/index';

// 也可以
// import type { Type } from '@/types';
```

#### 3. Tailwind CSS v4 配置错误
```
[postcss] It looks like you're trying to use `tailwindcss` directly as a PostCSS plugin...
```

**解决：**
- 安装 `@tailwindcss/postcss` 包
- 更新 `postcss.config.js` 中的插件配置
- 更新 `index.css` 使用 `@import "tailwindcss"` 语法
- 清理 Vite 缓存：`rm -rf .vite node_modules/.vite`

### CORS 跨域错误

**错误信息：**
```
Access to fetch at 'http://localhost:8787/api/xxx' from origin 'http://localhost:3000' 
has been blocked by CORS policy
```

**解决：**
1. 检查 Worker 中的 CORS 允许列表是否包含当前前端端口
2. 确保所有错误响应也添加了 CORS 标表
3. 检查 OPTIONS 预検请求是否被正常处理

### TypeScript 类型错误

**错误信息：**
```
TypeScript error: Cannot find module '@/...' or its type definitions
```

**解决：**
- 检查 `tsconfig.json` 中的 `compilerOptions.paths` 配置
- 检查 `vite.config.ts` 中的 `resolve.alias` 配置
- 检查目标文件是否实际存在
- 编辑器 TypeScript 映射可能需要重新加载

### 计费上报最佳实践

**通过 Metering API 上报计费：**

显示给用户的会话消耗候，应该通过 Metering Report API 上报实际成本：

```typescript
// Worker 中的计费上报示例

interface MeteringRequest {
  meteringId: string;  // 唯一 ID，防止重复计费
  cost: number;        // 实际消耗的您授权
  isFinal?: boolean;   // 是否为最终报告
}

// 1. 计算实际成本需求（例子）
const apiCost = 3.9;  // 根据API应用的幂等模式计算

// 2. 应用创建者定义的倍数（由创建者在 Creator Studio 中配置）
const multiplier = 5;  // 例子：创建者设置的成本倍数

// 3. 计算最终消耗（剛好是 0.0001 credits 的倍数）
const finalCost = apiCost * multiplier;  // 3.9 * 5 = 19.5

// 4. 上报计费

const meteringRequest: MeteringRequest = {
  meteringId: generateUniqueId(),  // 特殊: 每个计费报告需要唯一ID
  cost: finalCost,                  // 19.5 (0.0001 credits 的倍数）
  isFinal: true
};

const response = await fetch('https://api.mulerun.com/sessions/metering', {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${env.AGENT_KEY}`,
    'Content-Type': 'application/json'
  },
  body: JSON.stringify(meteringRequest)
});

if (!response.ok) {
  console.error('计费上报失败:', response.status);
  // 实现错误处理与重试機制
}

// 5. 前端显示
// 会话中显示: 本次消耗 19.5 Credits
```

**关键要点：**

- ✅ **meteringId 必须唯一**：防止重复计费（幂等性机制）
- ✅ **cost 是接收单位**：应该是 0.0001 credits 的倍数
- ✅ **使用幂等模式**：重复上报不会导致重复计费
- ✅ **标记最终报告**：isFinal = true 来终止会话
- ✅ **需使用 AGENT_KEY**：计费 API 使用 Agent Key 验证

### 端口和进程错误
**详细的端口和进程管理请参考：[DEVOPS_GUIDE.md](./DEVOPS_GUIDE.md)**

### 日志面板不显示
**详细的日志管理请参考：[DEVOPS_GUIDE.md](./DEVOPS_GUIDE.md)**

### 常见错误快速检查清单

| 错误 | 原因 | 解决 |
|------|------|------|
| import type 不存在 | 没有使用 `type` 关键字 | 改成 `import type {...}` |
| 路径自动完成不工作 | 路径别名配置不一致 | 检查 tsconfig 和 vite config |
| Tailwind 样式不应用 | PostCSS 配置不对 | 更新 `postcss.config.js` 中的插件 |
| CORS 跨域不通 | 平台端口改了 | 在 Worker CORS 允许列表中添加 |
| 上报计费错误 | 没有使用 Metering API | 使用正确的 meteringId，通过 Metering API 上报 |

### 调试技巧
1. 使用浏览器开发者工具
2. 查看 Network 面板的 API 请求
3. 检查 Console 的错误信息
4. 使用 `npx wrangler tail` 查看Worker实时日志
5. 使用 TypeScript 类型检查发现问题


---

**记住：保持简单、清晰、可维护。这些规则旨在帮助你快速构建高质量的Web应用，而不是限制你的创造力。**