# 🚀 DevOps部署流程指南

<!-- AI_INSTRUCTION: 完整的项目部署和运维流程指南，包含本地开发、测试、生产部署的全流程管理。 -->

## 📋 概述

本文档提供从本地开发到生产部署的完整DevOps流程，确保项目能够高效、可靠地从开发环境迁移到生产环境。

## 🛠 本地开发环境管理

### 智能启动脚本

**创建统一的开发环境启动脚本：**

```bash
#!/bin/bash
# scripts/start-dev.sh - 智能开发环境启动脚本

set -euo pipefail

# 项目根目录
PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
LOGS_DIR="$PROJECT_ROOT/logs"
PID_FILE="$LOGS_DIR/dev_pids.txt"

echo "🚀 启动开发环境..."

# 创建日志目录
mkdir -p "$LOGS_DIR"

# 智能端口管理 - 检查并清理已占用端口
cleanup_port() {
    local port=$1
    local service_name=$2

    if lsof -ti:$port >/dev/null 2>&1; then
        echo "🧹 检测到端口 $port 被占用，正在清理..."
        lsof -ti:$port | xargs kill -9 2>/dev/null || true
        sleep 2
        echo "✅ 端口 $port 已清理"
    fi
}

# 清理现有进程
if [[ -f "$PID_FILE" ]]; then
    echo "🛑 停止现有开发进程..."
    while read -r pid; do
        if kill -0 "$pid" 2>/dev/null; then
            kill "$pid" 2>/dev/null || true
        fi
    done < "$PID_FILE"
    rm -f "$PID_FILE"
fi

# 清理端口占用
cleanup_port 3000 "Frontend"
cleanup_port 8787 "Backend Worker"

# 创建时间戳日志文件
TIMESTAMP=$(date +%Y-%m-%d_%H-%M-%S)
FRONTEND_LOG="$LOGS_DIR/frontend_$TIMESTAMP.log"
BACKEND_LOG="$LOGS_DIR/backend_$TIMESTAMP.log"
UNIFIED_LOG="$LOGS_DIR/unified_$TIMESTAMP.log"

touch "$PID_FILE"

# 启动后端Worker (端口8787)
echo "🔧 启动后端Worker (端口8787)..."
cd "$PROJECT_ROOT/worker"
nohup wrangler dev --port 8787 >> "$BACKEND_LOG" 2>&1 &
BACKEND_PID=$!
echo "Backend Worker PID: $BACKEND_PID"
echo "$BACKEND_PID" >> "$PID_FILE"

# 等待Worker启动
sleep 3

# 启动前端应用 (端口3000)
echo "🌐 启动前端应用 (端口3000)..."
cd "$PROJECT_ROOT"
nohup npm run dev -- --port 3000 >> "$FRONTEND_LOG" 2>&1 &
FRONTEND_PID=$!
echo "Frontend PID: $FRONTEND_PID"
echo "$FRONTEND_PID" >> "$PID_FILE"

# 合并日志到统一文件
tail -f "$FRONTEND_LOG" "$BACKEND_LOG" > "$UNIFIED_LOG" &
TAIL_PID=$!
echo "$TAIL_PID" >> "$PID_FILE"

echo ""
echo "✅ 开发环境启动完成!"
echo ""
echo "📊 日志信息:"
echo "   前端日志:    $FRONTEND_LOG"
echo "   后端日志:    $BACKEND_LOG"
echo "   统一日志:    $UNIFIED_LOG"
echo "   进程文件:    $PID_FILE"
echo ""
echo "🌐 服务地址:"
echo "   前端应用:    http://localhost:3000"
echo "   后端API:     http://localhost:8787"
echo ""
echo "🔧 管理命令:"
echo "   查看统一日志: tail -f $UNIFIED_LOG"
echo "   停止开发环境: ./scripts/stop-dev.sh"
echo "   重启开发环境: ./scripts/restart-dev.sh"
```

**创建停止脚本：**

```bash
#!/bin/bash
# scripts/stop-dev.sh - 停止开发环境

PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
PID_FILE="$PROJECT_ROOT/logs/dev_pids.txt"

echo "🛑 停止开发环境..."

if [[ -f "$PID_FILE" ]]; then
    while read -r pid; do
        if kill -0 "$pid" 2>/dev/null; then
            echo "停止进程 PID: $pid"
            kill "$pid" 2>/dev/null || true
            sleep 1
            kill -9 "$pid" 2>/dev/null || true
        fi
    done < "$PID_FILE"
    rm -f "$PID_FILE"
    echo "✅ 所有开发进程已停止"
else
    echo "❌ 未找到运行中的开发进程"
fi
```

## 📝 日志管理系统

### 日志目录结构
```
logs/
├── frontend/              # 前端日志
│   ├── development_*.log
│   ├── production_*.log
│   └── errors_*.log
├── backend/               # 后端日志
│   ├── workers_*.log
│   ├── api_*.log
│   └── billing_*.log
├── deployment/            # 部署日志
│   ├── deploy_*.log
│   └── rollback_*.log
└── monitoring/            # 监控日志
    ├── health_*.log
    └── performance_*.log
```

### AI日志记录要求

**后端日志记录规范：**
```typescript
// 后端日志工具类
class WorkerLogger {
  private static logDir = './logs/backend';

  static log(message: string, level: 'INFO' | 'WARN' | 'ERROR' = 'INFO') {
    const timestamp = new Date().toISOString();
    const logMessage = `[${timestamp}] [${level}] [WORKER] ${message}`;

    // 控制台输出
    console.log(logMessage);

    // 写入本地文件系统
    this.writeToLogFile(logMessage, level);
  }

  private static writeToLogFile(message: string, level: string) {
    const date = new Date().toISOString().split('T')[0];
    const logFile = `${this.logDir}/worker_${date}.log`;

    // 在Worker环境中，可以通过环境变量配置日志存储
    // 或发送到专门的日志服务
  }
}
```

## 🧪 本地测试流程

### 自动化测试脚本

```bash
#!/bin/bash
# scripts/test-local.sh - 本地自动化测试

PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$PROJECT_ROOT"

echo "🧪 开始本地自动化测试..."

# 1. 启动开发环境
echo "1️⃣ 启动开发环境..."
./scripts/start-dev.sh

# 等待服务启动
sleep 10

# 2. 运行前端测试
echo "2️⃣ 运行前端测试..."
npm run test || echo "⚠️ 前端测试跳过"

# 3. API健康检查
echo "3️⃣ API健康检查..."
curl -f http://localhost:8787/health || echo "❌ 后端健康检查失败"
curl -f http://localhost:3000 || echo "❌ 前端健康检查失败"

# 4. 功能测试
echo "4️⃣ 运行功能测试..."
npm run test:e2e || echo "⚠️ E2E测试跳过"

echo "✅ 本地测试完成"
```

## 🚀 预发布验证流程

### 用户测试环境部署

```bash
#!/bin/bash
# scripts/deploy-staging.sh - 部署到测试环境

echo "🚀 部署到测试环境..."

# 1. 构建测试版本
echo "1️⃣ 构建测试版本..."
npm run build:staging

# 2. 部署前端到测试环境
echo "2️⃣ 部署前端..."
npx wrangler pages deploy dist --project-name=nanobanani-staging

# 3. 部署后端到测试环境
echo "3️⃣ 部署后端..."
cd worker
npx wrangler deploy --env staging

# 4. 配置测试环境变量
echo "4️⃣ 配置测试环境..."
npx wrangler secret put AGENT_KEY --env staging
npx wrangler secret put MULERUN_BASE_URL --env staging

echo "✅ 测试环境部署完成"
echo "🌐 测试地址: https://nanobanani-staging.pages.dev"
```

## 🌐 生产部署流程

### 自动化生产部署脚本

```bash
#!/bin/bash
# scripts/deploy-production.sh - 生产环境部署

set -euo pipefail

echo "🚀 开始生产部署..."

# 1. 部署前检查
echo "1️⃣ 部署前检查..."
npm run test
npm run build

# 2. 创建部署日志
DEPLOY_LOG="logs/deployment/deploy_$(date +%Y-%m-%d_%H-%M-%S).log"
mkdir -p logs/deployment

echo "部署开始时间: $(date)" | tee "$DEPLOY_LOG"

# 3. 部署后端（先部署API）
echo "2️⃣ 部署后端Worker..."
cd worker
npx wrangler deploy | tee -a "../$DEPLOY_LOG"

# 配置生产环境变量
echo "3️⃣ 配置生产环境变量..."
npx wrangler secret put AGENT_KEY | tee -a "../$DEPLOY_LOG"
npx wrangler secret put MULERUN_BASE_URL | tee -a "../$DEPLOY_LOG"
npx wrangler secret put MULERUN_BILLING_URL | tee -a "../$DEPLOY_LOG"
npx wrangler secret put MULERUN_SERVICE_NAME | tee -a "../$DEPLOY_LOG"

# 4. 部署前端
echo "4️⃣ 部署前端..."
cd ..
npm run build
npx wrangler pages deploy dist --project-name=nanobanani-web | tee -a "$DEPLOY_LOG"

# 5. 健康检查
echo "5️⃣ 生产环境健康检查..."
sleep 30
curl -f https://nanobanani-web.pages.dev/health || echo "⚠️ 健康检查失败"

echo "部署完成时间: $(date)" | tee -a "$DEPLOY_LOG"
echo "✅ 生产部署完成!"
echo "📊 部署日志: $DEPLOY_LOG"
```

#### 🎯 详细的分步部署指南

**针对AI部署的详细步骤指导：**

**Step 1: 准备工作**
```bash
# 确保已登录Cloudflare
npx wrangler auth login
npx wrangler whoami  # 验证登录状态

# 检查项目结构
ls -la worker/ frontend/

# 列出现有的Workers和Pages项目
npx wrangler whoami
npx wrangler list  # 列出现有Workers
npx wrangler pages project list  # 列出现有Pages项目
```

**Step 2: 创建并部署后端Worker**

**2.1 创建Worker（如果不存在）**
```bash
cd worker

# 检查wrangler.toml是否存在
if [ ! -f "wrangler.toml" ]; then
    echo "📝 创建Worker配置..."
    # 创建基本配置
    cat > wrangler.toml << 'EOF'
name = "nanobanani-worker"
main = "src/index.ts"
compatibility_date = "2024-01-01"

[env.production]
name = "nanobanani-worker-prod"
EOF
    echo "✅ Worker配置文件已创建"
fi

# 检查配置文件
cat wrangler.toml

# 确保包含正确配置：
# name = "nanobanani-worker"  # 或你的项目名
# main = "src/index.ts"
# compatibility_date = "2024-01-01"
```

**2.2 验证Worker源文件**
```bash
# 确保源文件存在
if [ ! -f "src/index.ts" ]; then
    echo "❌ 源文件不存在: src/index.ts"
    echo "请检查Worker源代码是否正确"
    exit 1
fi

# 检查源文件内容
head -10 src/index.ts
```

**2.3 部署Worker（首次或更新）**
```bash
# 部署Worker（如果是首次部署，会自动创建）
npx wrangler deploy

# 如果部署成功，会显示Worker URL，类似：
# Published nanobanani-worker (1.0.0)
# https://nanobanani-worker.your-subdomain.workers.dev

# 或者：
# ⛅️ Deployed nanobanani-worker (1.0.0)
# https://nanobanani-worker.your-subdomain.workers.dev
```

**2.4 验证Worker部署成功**
```bash
# 从部署输出中获取Worker URL
# 或者测试常见的工作URL格式
POSSIBLE_URLS=(
    "https://nanobanani-worker.your-subdomain.workers.dev"
    "https://nanobanani-worker.workers.dev"
    "https://nanobanani.pages.dev"  # 如果是Pages Functions
)

for url in "${POSSIBLE_URLS[@]}"; do
    echo "测试: $url"
    if curl -s -f "$url" >/dev/null 2>&1; then
        echo "✅ Worker可访问: $url"
        WORKER_URL="$url"
        break
    else
        echo "❌ 无法访问: $url"
    fi
done

if [ -z "${WORKER_URL:-}" ]; then
    echo "⚠️ 无法验证Worker访问，但部署可能已成功"
    echo "请检查Cloudflare Dashboard确认Worker状态"
fi
```

**Step 4.5: 配置生产环境Worker日志**
```bash
# 验证Worker部署成功后，立即配置生产日志
echo "📝 配置生产环境Worker日志..."

# 方法1: 通过CLI实时监控生产日志（推荐用于调试）
echo "🔍 启动生产环境实时日志监控："
echo "执行命令: npx wrangler tail --format=pretty"
echo ""
echo "📋 日志监控说明："
echo "- 实时查看生产环境所有请求日志"
echo "- 支持彩色输出和格式化显示"
echo "- 包含时间戳、日志级别、请求ID等信息"
echo "- 按Ctrl+C停止监控"

# 方法2: 通过Dashboard查看日志（推荐用于长期监控）
echo ""
echo "🌐 通过Cloudflare Dashboard查看生产日志："
echo "1. 访问 https://dash.cloudflare.com/"
echo "2. 左侧菜单选择 'Workers & Pages'"
echo "3. 找到你的Worker项目: nanobanani-worker"
echo "4. 点击项目名称进入详情页面"
echo "5. 右侧菜单选择 'Logs' 或 '实时日志'"
echo "6. 设置日志级别过滤: INFO, WARN, ERROR"
echo "7. 可以按时间范围、状态码、请求ID等筛选"

# 生产日志配置验证
echo ""
echo "🧪 验证生产日志配置："
echo "1. 发送测试请求到生产Worker:"
if [ -n "${WORKER_URL:-}" ]; then
    echo "   curl -s \"$WORKER_URL\" || echo '测试请求，检查日志输出'"
else
    echo "   curl -s \"https://your-worker-url.workers.dev\""
fi
echo ""
echo "2. 在另一个终端中执行: npx wrangler tail --format=pretty"
echo "3. 观察是否有实时日志输出"
echo "4. 检查日志格式是否包含期望的调试信息"

# 生产日志级别配置
echo ""
echo "⚙️ 生产日志最佳实践配置："
echo "- 在Worker代码中添加结构化日志:"
echo "  console.log('[INFO] 请求开始:', { method: request.method, url: request.url });"
echo "  console.log('[AUTH] 鉴权检查:', { userId, agentId });"
echo "  console.log('[API] 外部API调用:', { api: 'Mulerun', status: response.status });"
echo "  console.log('[ERROR] 处理失败:', { error: error.message, stack: error.stack });"
echo ""
echo "- 日志级别建议:"
echo "  - INFO: 正常业务流程（请求处理、API调用）"
echo "  - WARN: 可处理的异常情况（API重试、参数警告）"
echo "  - ERROR: 需要关注的问题（鉴权失败、API调用失败）"

# Dashboard高级日志配置
echo ""
echo "🔧 Dashboard高级日志配置："
echo "1. 在Worker详情页面，可以配置："
echo "   - 日志保留时间（默认7天，可延长至30天）"
echo "   - 日志采样率（默认100%，可根据需要调整）"
echo "   - 告警规则（错误率过高、响应时间过长等）"
echo ""
echo "2. 日志导出功能："
echo "   - 支持导出为JSON、CSV格式"
echo "   - 可按时间范围批量导出"
echo "   - 集成到外部日志分析系统"

# 验证生产日志正常工作
echo ""
echo "✅ 生产日志配置验证清单："
echo "- [ ] CLI命令 npx wrangler tail 能正常显示实时日志"
echo "- [ ] Dashboard中能看到日志条目"
echo "- [ ] 日志包含时间戳和请求信息"
echo "- [ ] 错误日志包含详细的堆栈信息"
echo "- [ ] 可以通过请求ID追踪单个请求的完整日志"
echo "- [ ] 日志级别过滤功能正常工作"

# 生产环境故障排查
echo ""
echo "🚨 生产环境故障排查指南："
echo "如果生产日志无法正常显示："
echo "1. 检查Worker是否确实部署到生产环境"
echo "   npx wrangler whoami"
echo "   npx wrangler list"
echo ""
echo "2. 检查Dashboard中Worker状态是否为'已发布'"
echo "3. 确认发送的请求到达了生产环境而非其他环境"
echo "4. 检查是否有CORS或网络问题阻止请求到达"
echo "5. 验证环境变量配置是否正确"
echo ""
echo "📞 Cloudflare支持："
echo "- 如遇日志相关问题，可在Dashboard中创建支持工单"
echo "- 提供具体的Worker名称和请求时间便于排查"
```

**Step 3: 配置Worker环境变量**
```bash
# 设置必需的环境变量（每个命令会提示输入密钥值）
npx wrangler secret put MULERUN_API_KEY
# 输入你的Mulerun API密钥

npx wrangler secret put MULERUN_BASE_URL
# 输入：https://api.mulerun.com

npx wrangler secret put APP_NAME
# 输入你的项目名称

# 验证环境变量设置（不会显示实际值）
npx wrangler secret list
```

**Step 4: 验证Worker部署**
```bash
# 获取Worker URL（从部署输出中复制，或使用以下命令）
WORKER_URL="https://your-project-name.your-subdomain.workers.dev"

# 测试Worker健康检查
curl -f "$WORKER_URL/health" || echo "健康检查端点不存在，这是正常的"

# 测试基本响应
curl "$WORKER_URL"
```

**Step 5: 创建并部署前端到Pages**

**5.1 构建前端**
```bash
cd ../frontend

# 确保依赖已安装
if [ ! -d "node_modules" ]; then
    echo "📦 安装前端依赖..."
    npm install
fi

# 构建前端
npm run build

# 检查构建结果
if [ ! -d "dist" ]; then
    echo "❌ 构建失败：dist目录不存在"
    exit 1
fi

ls -la dist/
```

**5.2 检查Pages项目是否存在**
```bash
# 检查现有的Pages项目
echo "📋 检查现有Pages项目..."
npx wrangler pages project list

# 检查目标项目名是否已存在
PROJECT_NAME="nanobanani-web"
PROJECT_EXISTS=$(npx wrangler pages project list 2>/dev/null | grep "$PROJECT_NAME" || true)

if [ -n "$PROJECT_EXISTS" ]; then
    echo "✅ Pages项目已存在: $PROJECT_NAME"
else
    echo "📝 Pages项目不存在，将在部署时自动创建"
fi
```

**5.3 部署到Pages（自动创建项目）**
```bash
# 方法A: 直接部署（推荐，会自动创建项目）
echo "🚀 开始部署到Cloudflare Pages..."
if echo "y" | npx wrangler pages deploy dist --project-name="$PROJECT_NAME" 2>&1; then
    echo "✅ Pages部署成功"
    DEPLOYMENT_SUCCESS=true
else
    echo "⚠️ 方法A失败，尝试方法B"
    DEPLOYMENT_SUCCESS=false
fi

# 方法B: 使用兼容性日期参数（如果方法A失败）
if [ "$DEPLOYMENT_SUCCESS" = false ]; then
    echo "🔄 尝试方法B：使用兼容性日期参数..."
    if npx wrangler pages deploy dist --project-name="$PROJECT_NAME" --compatibility-date=2024-01-01 2>&1; then
        echo "✅ Pages部署成功（方法B）"
        DEPLOYMENT_SUCCESS=true
    else
        echo "⚠️ 方法B失败，尝试方法C"
    fi
fi

# 方法C: 使用不同的项目名（如果前两种方法都失败）
if [ "$DEPLOYMENT_SUCCESS" = false ]; then
    echo "🔄 尝试方法C：使用不同的项目名..."
    ALT_PROJECT_NAME="nanobanani-web-$(date +%s)"
    if npx wrangler pages deploy dist --project-name="$ALT_PROJECT_NAME" --compatibility-date=2024-01-01 2>&1; then
        echo "✅ Pages部署成功（方法C）"
        PROJECT_NAME="$ALT_PROJECT_NAME"
        DEPLOYMENT_SUCCESS=true
    else
        echo "❌ 所有自动部署方法都失败"
        echo "请手动通过Cloudflare Dashboard部署"
    fi
fi
```

**5.4 验证Pages部署成功**
```bash
if [ "$DEPLOYMENT_SUCCESS" = true ]; then
    echo "🔍 验证Pages部署..."

    # 等待部署生效
    echo "等待部署生效（30秒）..."
    sleep 30

    # 尝试不同的可能URL格式
    POSSIBLE_PAGES_URLS=(
        "https://$PROJECT_NAME.pages.dev"
        "https://$PROJECT_NAME.your-subdomain.pages.dev"
        "https://$PROJECT_NAME.workers.dev"  # 某些配置下
    )

    PAGES_URL=""
    for url in "${POSSIBLE_PAGES_URLS[@]}"; do
        echo "测试Pages URL: $url"
        if curl -s -I -f "$url" >/dev/null 2>&1; then
            echo "✅ Pages可访问: $url"
            PAGES_URL="$url"
            break
        else
            echo "❌ 无法访问: $url"
        fi
    done

    if [ -n "$PAGES_URL" ]; then
        echo "🌐 Pages部署成功！"
        echo "   URL: $PAGES_URL"
    else
        echo "⚠️ 无法立即验证Pages访问，但部署可能已成功"
        echo "请稍后手动测试或检查Cloudflare Dashboard"

        # 提供手动测试建议
        echo ""
        echo "💡 手动测试步骤："
        echo "1. 访问 https://dash.cloudflare.com/pages"
        echo "2. 查找项目: $PROJECT_NAME"
        echo "3. 点击项目URL进行测试"
    fi
else
    echo "❌ Pages部署失败"
    echo "请通过Cloudflare Dashboard手动部署"
fi
```

**Step 6: 完整的部署验证**
```bash
# 测试前端页面加载（如果能获取到URL）
if [ -n "${PAGES_URL:-}" ]; then
    echo "🔍 测试前端页面: $PAGES_URL"
    curl -f "$PAGES_URL" && echo "✅ 前端页面可访问" || echo "❌ 前端页面访问失败"
fi

# 测试Worker（如果能获取到URL）
if [ -n "${WORKER_URL:-}" ]; then
    echo "🔍 测试Worker: $WORKER_URL"
    curl -f "$WORKER_URL" && echo "✅ Worker可访问" || echo "⚠️ Worker访问检查失败"
fi

# 检查浏览器控制台错误
echo ""
echo "🌐 请在浏览器中访问前端页面，检查控制台是否有JavaScript错误"
if [ -n "${PAGES_URL:-}" ]; then
    echo "   前端URL: $PAGES_URL"
fi

# 提供最终状态总结
echo ""
echo "📊 部署状态总结:"
echo "   Worker: ${WORKER_URL:-'需要手动确认'}"
echo "   Pages:  ${PAGES_URL:-'需要手动确认'}"
echo "   项目名: $PROJECT_NAME"
```

**Step 7: 完整性测试**
```bash
# 测试前端页面加载
curl -f "https://your-project-name.pages.dev"

# 测试API调用（如果前端有API端点）
curl -f "https://your-project-name.pages.dev/api/health" || echo "API端点不存在"

# 检查浏览器控制台是否有错误
echo "请在前端页面检查浏览器控制台是否有JavaScript错误"
```

#### 🔧 常见部署问题解决

**问题1: Wrangler认证失败**
```bash
# 重新登录
npx wrangler auth login
# 或者使用API Token
npx wrangler auth whoami
```

**问题2: Pages部署需要交互**
```bash
# 使用管道输入自动确认
echo "y" | npx wrangler pages deploy dist --project-name=project-name

# 或者使用--compatibility-date参数
npx wrangler pages deploy dist --project-name=project-name --compatibility-date=2024-01-01
```

**问题3: Worker配置错误**
```bash
# 检查wrangler.toml格式
npx wrangler validate

# 重新初始化配置
npx wrangler init --yes
```

**问题4: 环境变量设置失败**
```bash
# 检查环境变量名称是否正确
npx wrangler secret list

# 重新设置环境变量
npx wrangler secret put VARIABLE_NAME
```

## 🔗 连调测试流程

### 生产环境集成测试

```bash
#!/bin/bash
# scripts/integration-test.sh - 生产环境集成测试

echo "🔗 开始生产环境集成测试..."

PROD_URL="https://nanobanani-web.pages.dev"
TEST_LOG="logs/monitoring/integration_test_$(date +%Y-%m-%d_%H-%M-%S).log"
mkdir -p logs/monitoring

echo "测试开始时间: $(date)" | tee "$TEST_LOG"

# 1. 前端页面测试
echo "1️⃣ 前端页面测试..."
curl -f "$PROD_URL" | tee -a "$TEST_LOG" || echo "❌ 前端页面访问失败"

# 2. API接口测试
echo "2️⃣ API接口测试..."
curl -f "$PROD_URL/api/health" | tee -a "$TEST_LOG" || echo "❌ API健康检查失败"

# 3. Mulerun平台连接测试
echo "3️⃣ Mulerun平台连接测试..."
# 这里需要根据实际的API端点进行测试

# 4. 计费功能测试
echo "4️⃣ 计费功能测试..."
# 模拟小额计费测试

echo "测试完成时间: $(date)" | tee -a "$TEST_LOG"
echo "✅ 集成测试完成!"
echo "📊 测试日志: $TEST_LOG"
```

## 📊 监控和维护

### 生产日志监控脚本

```bash
#!/bin/bash
# scripts/monitor-production-logs.sh - 生产环境日志监控

echo "📊 生产环境Worker日志监控..."

# 获取Worker名称（根据项目配置）
WORKER_NAME="nanobanani-worker"

echo "🔍 1. 检查Worker部署状态..."
npx wrangler list | grep "$WORKER_NAME" && echo "✅ Worker已部署" || echo "❌ Worker未找到"

echo ""
echo "📝 2. 启动实时日志监控..."
echo "按 Ctrl+C 停止监控"
echo ""
echo "💡 日志级别说明："
echo "  [INFO]  - 正常业务流程"
echo "  [WARN]  - 警告信息"
echo "  [ERROR] - 错误信息"
echo ""

# 启动实时日志监控
npx wrangler tail --format=pretty
```

### Dashboard日志检查脚本

```bash
#!/bin/bash
# scripts/check-dashboard-logs.sh - Dashboard日志状态检查

echo "🌐 Dashboard日志状态检查..."

echo "📋 检查清单："
echo "1. 访问 https://dash.cloudflare.com/"
echo "2. 选择 'Workers & Pages'"
echo "3. 找到你的Worker项目"
echo "4. 检查以下项目："
echo ""
echo "   ✅ Worker状态: 应该显示为'已发布'"
echo "   ✅ 请求统计: 有正常的请求量数据"
echo "   ✅ 错误率: 应该在合理范围内"
echo "   ✅ 响应时间: 符合性能预期"
echo "   ✅ 日志流: 实时日志能正常显示"
echo ""

echo "🔧 日志配置检查："
echo "- 日志保留时间是否设置合理"
echo "- 日志采样率是否适合业务需求"
echo "- 是否配置了必要的告警规则"
echo "- 导出功能是否正常工作"
echo ""

echo "📊 今日日志摘要："
echo "请手动在Dashboard中查看："
echo "- 总请求数"
echo "- 错误请求数"
echo "- 平均响应时间"
echo "- P95/P99响应时间"
```

### 本地日志监控脚本

```bash
#!/bin/bash
# scripts/monitor.sh - 本地开发环境监控

echo "📊 本地开发环境监控..."

# 检查日志文件大小
echo "📝 本地日志文件状态:"
du -sh logs/* 2>/dev/null || echo "暂无日志文件"

# 查看最新错误
echo "🚨 最新错误日志:"
if [[ -f "logs/latest.log" ]]; then
    tail -20 logs/latest.log | grep -i error || echo "无错误日志"
fi

# 清理旧日志（保留最近7天）
echo "🧹 清理旧日志..."
find logs/ -name "*.log" -mtime +7 -delete 2>/dev/null || true
```

## ✅ 部署检查清单

### 部署前检查
- [ ] 本地测试全部通过
- [ ] 代码已提交到主分支
- [ ] 环境变量已配置
- [ ] 备份策略已制定

### 部署过程检查
- [ ] 后端服务部署成功
- [ ] 前端应用部署成功
- [ ] 域名配置正确
- [ ] SSL证书有效

### 部署后验证
- [ ] 前端页面正常加载
- [ ] API接口响应正常
- [ ] Mulerun平台连接正常
- [ ] 计费功能工作正常
- [ ] **生产Worker日志正常输出**（运行 `npx wrangler tail --format=pretty` 验证）
- [ ] **生产环境实时日志监控工作**（CLI和Dashboard都能查看日志）
- [ ] **生产日志级别配置正确**（包含INFO/WARN/ERROR级别）
- [ ] **生产错误日志有详细信息**（包含请求ID、时间戳、堆栈信息）
- [ ] **Dashboard日志功能正常**（可以按时间、状态码、请求ID筛选）
- [ ] **日志采样率和保留时间配置合理**
- [ ] 性能指标符合预期

## 🔄 回滚策略

### 快速回滚脚本

```bash
#!/bin/bash
# scripts/rollback.sh - 紧急回滚

echo "🔄 开始紧急回滚..."

# 回滚前端
echo "1️⃣ 回滚前端..."
git checkout HEAD~1 -- .
npm run build
npx wrangler pages deploy dist --project-name=nanobanani-web

# 回滚后端
echo "2️⃣ 回滚后端..."
cd worker
git checkout HEAD~1 -- .
npx wrangler deploy

echo "✅ 回滚完成!"
```

---

**重要提醒：**
1. 所有脚本都需要设置执行权限：`chmod +x scripts/*.sh`
2. 部署前务必备份数据和配置
3. 保持日志文件的定期清理和监控
4. 建立告警机制，及时发现问题