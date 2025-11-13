import type { Env, MeteringReportRequest } from '../types/index'

/**
 * 生成唯一 meteringId
 * @param sessionId 会话ID
 * @returns 唯一的meteringId
 */
export function generateMeteringId(sessionId: string): string {
  const timestamp = Date.now()
  const random = Math.random().toString(36).substring(2, 9)
  return `${sessionId}-${timestamp}-${random}`
}

/**
 * 上报计费信息到 MuleRun Metering API
 * @param sessionId 会话ID
 * @param cost 消耗的Credits
 * @param env 环境变量
 * @param isFinal 是否为最终报告
 */
export async function reportMetering(
  sessionId: string,
  cost: number,
  env: Env,
  isFinal: boolean = false
): Promise<string> {
  const meteringId = generateMeteringId(sessionId)
  
  console.log('[METERING] 💰 开始上报计费信息')
  console.log('[METERING] 📝 Session ID:', sessionId)
  console.log('[METERING] 💵 Cost:', cost, 'Credits')
  console.log('[METERING] 🔑 Metering ID:', meteringId)
  console.log('[METERING] 🏁 Is Final:', isFinal)

  try {
    const request: MeteringReportRequest = {
      meteringId,
      cost,
      isFinal
    }

    const response = await fetch(
      `${env.MULERUN_BASE_URL}/sessions/metering`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${env.AGENT_KEY}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(request)
      }
    )

    if (!response.ok) {
      const errorText = await response.text()
      console.error('[METERING] ❌ 计费上报失败:', response.status, errorText)
      // 注意：计费上报失败不抛出错误，不影响图像返回
    } else {
      const result = await response.json()
      console.log('[METERING] ✅ 计费上报成功:', result)
    }

    return meteringId
  } catch (error) {
    console.error('[METERING] ❌ 计费上报异常:', error)
    // 不抛出错误，继续返回图像
    return meteringId
  }
}

/**
 * 计算最终成本
 * @param baseCost 基础成本
 * @param env 环境变量
 * @returns 最终成本（保留4位小数）
 */
export function calculateFinalCost(baseCost: number, env: Env): number {
  const multiplier = parseFloat(env.CREATOR_MULTIPLIER || '1.0')
  const finalCost = Math.round(baseCost * multiplier * 10000) / 10000
  
  console.log('[METERING] 💹 成本计算:')
  console.log('[METERING]   基础成本:', baseCost, 'Credits')
  console.log('[METERING]   倍数:', multiplier)
  console.log('[METERING]   最终成本:', finalCost, 'Credits')
  
  return finalCost
}
