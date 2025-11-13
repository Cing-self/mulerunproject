import type { Env } from './types/index'
import { handleGenerate } from './handlers/generate'

/**
 * Cloudflare Worker 主入口
 */
export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url)
    
    console.log('[WORKER] 📨 收到请求:', request.method, url.pathname)

    // 处理 CORS 预检请求
    if (request.method === 'OPTIONS') {
      return handleCORS()
    }

    // 路由分发
    if (url.pathname === '/api/generate' && request.method === 'POST') {
      return handleGenerate(request, env)
    }

    // 图片代理下载接口
    if (url.pathname === '/api/download-image' && request.method === 'POST') {
      return handleImageDownload(request)
    }

    if (url.pathname === '/api/health' && request.method === 'GET') {
      return new Response(JSON.stringify({
        status: 'ok',
        timestamp: new Date().toISOString(),
        service: env.APP_NAME || 'nano-banana-generator'
      }), {
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*'
        }
      })
    }

    // 404 未找到
    return new Response(JSON.stringify({
      error: 'Not Found',
      path: url.pathname
    }), {
      status: 404,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      }
    })
  }
}

/**
 * 处理 CORS 预检请求
 */
function handleCORS(): Response {
  return new Response(null, {
    status: 204,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
      'Access-Control-Max-Age': '86400'
    }
  })
}

/**
 * 处理图片下载代理请求
 */
async function handleImageDownload(request: Request): Promise<Response> {
  console.log('[DOWNLOAD] 📊 收到图片下载请求')
  
  try {
    const { imageUrl } = await request.json() as { imageUrl: string }
    
    if (!imageUrl) {
      return new Response(JSON.stringify({
        success: false,
        error: '缺少 imageUrl 参数'
      }), {
        status: 400,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*'
        }
      })
    }

    console.log('[DOWNLOAD] 📥 获取图片:', imageUrl.substring(0, 100) + '...')
    
    // 代理请求图片
    const imageResponse = await fetch(imageUrl)
    
    if (!imageResponse.ok) {
      console.error('[DOWNLOAD] ❌ 获取图片失败:', imageResponse.status)
      return new Response(JSON.stringify({
        success: false,
        error: '获取图片失败'
      }), {
        status: 500,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*'
        }
      })
    }

    // 返回图片数据
    const imageBlob = await imageResponse.blob()
    console.log('[DOWNLOAD] ✅ 图片获取成功, 大小:', imageBlob.size, 'bytes')
    
    return new Response(imageBlob, {
      headers: {
        'Content-Type': imageResponse.headers.get('Content-Type') || 'image/png',
        'Access-Control-Allow-Origin': '*',
        'Content-Disposition': 'attachment; filename="nano-banana.png"'
      }
    })
    
  } catch (error) {
    console.error('[DOWNLOAD] ❌ 下载异常:', error)
    return new Response(JSON.stringify({
      success: false,
      error: '下载失败'
    }), {
      status: 500,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      }
    })
  }
}
