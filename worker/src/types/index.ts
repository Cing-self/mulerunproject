// 环境变量类型
export interface Env {
  AGENT_KEY: string                // MuleRun Agent Key
  MULERUN_API_KEY: string          // MuleRun API Key
  MULERUN_BASE_URL: string         // MuleRun API Base URL
  APP_NAME: string                 // 应用名称
  CREATOR_MULTIPLIER?: string      // 计费倍数（可选）
}

// Metering Report 请求
export interface MeteringReportRequest {
  meteringId: string        // 唯一计费 ID（防重复）
  cost: number              // 消耗的 Credits (0.0001 的倍数)
  isFinal: boolean          // 是否为最终报告
}
