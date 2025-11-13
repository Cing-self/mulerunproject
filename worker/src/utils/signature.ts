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
      console.warn('[AUTH] ⚠️ 未找到 signature 参数')
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
      .replace(/, /g, ',')   // 移除逗号后的空格

    console.log('[AUTH] 📝 Signature Payload:', sortedPayload)

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
      console.warn('[AUTH] ❌ iframe Signature 验证失败', {
        received: receivedSignature,
        expected: expectedSignature
      })
    } else {
      console.log('[AUTH] ✅ iframe Signature 验证成功')
    }

    return isValid
    
  } catch (error) {
    console.error('[AUTH] ❌ 签名验证异常', error)
    return false
  }
}
