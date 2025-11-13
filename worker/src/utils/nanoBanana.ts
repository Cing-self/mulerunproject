import type { Env } from '../types/index'

/**
 * Nano Banana 任务创建响应
 */
interface TaskCreateResponse {
  task_info: {
    id: string
    status: 'pending' | 'processing' | 'completed' | 'failed'
    created_at: string
    updated_at: string
  }
}

/**
 * Nano Banana 任务结果响应
 */
interface TaskResultResponse {
  task_info: {
    id: string
    status: 'pending' | 'processing' | 'completed' | 'failed'
    created_at: string
    updated_at: string
  }
  images?: string[]  // Base64 编码的图像数组
}

/**
 * 调用 Nano Banana 生成图像（使用 Vendor API 异步任务模式）
 * @param prompt 用户提示词
 * @param env 环境变量
 * @returns 图像数据和token使用量
 */
export async function callNanoBanana(
  prompt: string,
  env: Env
): Promise<{ imageData: string; tokensUsed: number }> {
  console.log('[NANO_BANANA] 🎨 开始调用 Nano Banana Vendor API')
  console.log('[NANO_BANANA] 📝 Prompt:', prompt.substring(0, 100) + '...')

  try {
    // 步骤 1: 提交任务
    console.log('[NANO_BANANA] 🚀 提交图像生成任务...')
    const createResponse = await fetch(
      `${env.MULERUN_BASE_URL}/vendors/google/v1/nano-banana/generation`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${env.MULERUN_API_KEY}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          prompt: prompt,
          number_of_images: 1,
          aspect_ratio: '1:1'  // 默认使用1:1比例
        })
      }
    )

    if (!createResponse.ok) {
      const errorText = await createResponse.text()
      console.error('[NANO_BANANA] ❌ 任务提交失败:', createResponse.status, errorText)
      throw new Error(`Nano Banana task creation failed: ${createResponse.status}`)
    }

    const createData: TaskCreateResponse = await createResponse.json()
    const taskId = createData.task_info.id
    
    console.log('[NANO_BANANA] ✅ 任务已提交, Task ID:', taskId)
    console.log('[NANO_BANANA] 🔄 开始轮询任务状态...')

    // 步骤 2: 轮询查询任务结果
    const maxAttempts = 60  // 最多轮询60次
    const pollInterval = 2000  // 每2秒轮询一次
    
    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      // 等待一段时间再查询
      if (attempt > 1) {
        await new Promise(resolve => setTimeout(resolve, pollInterval))
      }

      console.log(`[NANO_BANANA] 🔍 第 ${attempt} 次查询任务状态...`)
      
      const resultResponse = await fetch(
        `${env.MULERUN_BASE_URL}/vendors/google/v1/nano-banana/generation/${taskId}`,
        {
          method: 'GET',
          headers: {
            'Authorization': `Bearer ${env.MULERUN_API_KEY}`
          }
        }
      )

      if (!resultResponse.ok) {
        const errorText = await resultResponse.text()
        console.error('[NANO_BANANA] ❌ 查询任务失败:', resultResponse.status, errorText)
        throw new Error(`Task query failed: ${resultResponse.status}`)
      }

      const resultData: TaskResultResponse = await resultResponse.json()
      const status = resultData.task_info.status
      
      console.log(`[NANO_BANANA] 📊 任务状态: ${status}`)

      if (status === 'completed') {
        // 任务完成，提取图像
        const imageData = resultData.images?.[0]
        
        if (!imageData) {
          console.error('[NANO_BANANA] ❌ 响应中未找到图像数据')
          console.error('[NANO_BANANA] 📦 完整响应:', JSON.stringify(resultData))
          throw new Error('No image data in completed task')
        }

        console.log('[NANO_BANANA] ✅ 图像生成成功')
        console.log('[NANO_BANANA] 📏 图像数据长度:', imageData.length, '字符')

        return {
          imageData: imageData,
          tokensUsed: 0  // Vendor API 不返回 token 统计
        }
      } else if (status === 'failed') {
        console.error('[NANO_BANANA] ❌ 任务失败')
        throw new Error('Image generation task failed')
      }
      
      // status 为 'pending' 或 'processing'，继续轮询
    }

    // 超出最大尝试次数
    console.error('[NANO_BANANA] ❌ 任务超时')
    throw new Error('Task polling timeout')

  } catch (error) {
    console.error('[NANO_BANANA] ❌ 调用异常:', error)
    throw error
  }
}
