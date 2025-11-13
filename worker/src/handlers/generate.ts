import type { Env } from '../types/index'
import { verifyRequestSignature } from '../utils/signature'
import { callNanoBanana } from '../utils/nanoBanana'
import { reportMetering, calculateFinalCost } from '../utils/metering'

/**
 * 处理图像生成请求
 */
export async function handleGenerate(
  request: Request,
  env: Env
): Promise<Response> {
  console.log('[GENERATE] 🚀 收到图像生成请求')
  
  try {
    // 解析请求体
    const requestBody = await request.json() as Record<string, any>
    
    console.log('[GENERATE] 📦 请求体:', {
      prompt: requestBody.prompt?.substring(0, 50) + '...',
      sessionId: requestBody.sessionId,
      userId: requestBody.userId
    })

    // 1. 验证签名
    console.log('[GENERATE] 🔐 开始验证签名...')
    const isValid = await verifyRequestSignature(requestBody, env)
    
    if (!isValid) {
      console.warn('[GENERATE] ❌ 签名验证失败')
      return jsonResponse({
        success: false,
        error: '签名验证失败',
        errorCode: 'SIGNATURE_INVALID'
      }, 401)
    }

    // 2. 提取参数
    const { prompt, sessionId } = requestBody
    
    if (!prompt || !sessionId) {
      console.warn('[GENERATE] ❌ 缺少必需参数')
      return jsonResponse({
        success: false,
        error: '缺少必需参数',
        errorCode: 'MISSING_PARAMS'
      }, 400)
    }

    // 验证提示词长度
    if (prompt.length < 5) {
      return jsonResponse({
        success: false,
        error: '提示词至少需要 5 个字符',
        errorCode: 'PROMPT_TOO_SHORT'
      }, 400)
    }

    if (prompt.length > 500) {
      return jsonResponse({
        success: false,
        error: '提示词不能超过 500 个字符',
        errorCode: 'PROMPT_TOO_LONG'
      }, 400)
    }

    // 3. 调用 Nano Banana
    console.log('[GENERATE] 🎨 调用 Nano Banana API...')
    const { imageData, tokensUsed } = await callNanoBanana(prompt, env)

    // 4. 计算成本
    const baseCost = 3.9  // Nano Banana 基础成本 (3.9 credits/image)
    const finalCost = calculateFinalCost(baseCost, env)

    // 5. 上报计费
    console.log('[GENERATE] 💰 上报计费信息...')
    const meteringId = await reportMetering(sessionId, finalCost, env, false)

    // 6. 返回结果
    console.log('[GENERATE] ✅ 图像生成成功')
    return jsonResponse({
      success: true,
      data: {
        imageData,
        creditsUsed: finalCost,
        meteringId
      }
    })

  } catch (error) {
    console.error('[GENERATE] ❌ 生成失败:', error)
    
    const errorMessage = error instanceof Error ? error.message : '生成失败'
    
    return jsonResponse({
      success: false,
      error: errorMessage,
      errorCode: 'GENERATION_ERROR'
    }, 500)
  }
}

/**
 * 返回 JSON 响应的辅助函数
 */
function jsonResponse(data: any, status: number = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type'
    }
  })
}
