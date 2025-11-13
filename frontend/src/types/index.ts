// MuleRun 平台传递的 iframe 参数
export interface IframeParams {
  userId: string          // 用户 ID
  agentId: string         // Agent ID
  time: string            // 时间戳（字符串格式）
  nonce: string           // 随机数
  origin: string          // 来源
  sessionId: string       // 会话 ID
  signature: string       // HMAC-SHA256 签名
}

// 生成的图像数据
export interface GeneratedImage {
  id: string                       // 唯一标识
  prompt: string                   // 使用的提示词
  imageData: string                // Base64 编码的图像数据
  timestamp: number                // 生成时间戳
  creditsUsed: number              // 本次消费的 Credits
}

// 提示词模板
export interface PromptTemplate {
  id: string                       // 模板唯一标识
  name: string                     // 模板名称
  prompt: string                   // 模板内容（含占位符）
  category: string                 // 分类标签
  description: string              // 模板描述
}

// 图像生成请求
export interface GenerateImageRequest {
  prompt: string                   // 用户提示词
  userId: string                   // 从 iframe 参数提取
  agentId: string                  // 从 iframe 参数提取
  sessionId: string                // 从 iframe 参数提取
  time: string                     // 从 iframe 参数提取
  nonce: string                    // 从 iframe 参数提取
  origin: string                   // 从 iframe 参数提取
  signature: string                // 从 iframe 参数提取
}

// 图像生成响应
export interface GenerateImageResponse {
  success: boolean
  data?: {
    imageData: string              // Base64 编码的图像
    creditsUsed: number            // 本次消耗的 Credits
    meteringId: string             // 计费记录 ID
  }
  error?: string                   // 错误信息
  errorCode?: string               // 错误代码
}
