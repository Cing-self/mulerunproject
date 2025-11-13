import { useState, useEffect } from 'react'
import { Sparkles, Image as ImageIcon, AlertCircle, Loader2, Download } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Skeleton } from '@/components/ui/skeleton'
import { promptTemplates } from '@/utils/templates'
import type { IframeParams, GeneratedImage, GenerateImageResponse } from '@/types/index'

function App() {
  // 状态管理
  const [prompt, setPrompt] = useState<string>('')
  const [selectedTemplate, setSelectedTemplate] = useState<string>('')
  const [isGenerating, setIsGenerating] = useState<boolean>(false)
  const [currentImage, setCurrentImage] = useState<GeneratedImage | null>(null)
  const [history, setHistory] = useState<GeneratedImage[]>([])
  const [error, setError] = useState<string | null>(null)
  const [totalCredits, setTotalCredits] = useState<number>(0)
  const [iframeParams, setIframeParams] = useState<IframeParams | null>(null)
  const [dialogOpen, setDialogOpen] = useState<boolean>(false)
  const [selectedHistoryImage, setSelectedHistoryImage] = useState<GeneratedImage | null>(null)

  // 从 URL 提取 iframe 参数
  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    
    const requiredParams = [
      'userId', 'agentId', 'time',
      'nonce', 'origin', 'sessionId', 'signature'
    ]
    
    const hasAllParams = requiredParams.every(key => params.has(key))
    
    if (hasAllParams) {
      setIframeParams({
        userId: params.get('userId')!,
        agentId: params.get('agentId')!,
        time: params.get('time')!,
        nonce: params.get('nonce')!,
        origin: params.get('origin')!,
        sessionId: params.get('sessionId')!,
        signature: params.get('signature')!
      })
    } else {
      console.warn('⚠️ 缺少必需的 iframe 参数，使用测试模式')
      // 测试模式下使用模拟参数
      setIframeParams({
        userId: 'test-user',
        agentId: 'test-agent',
        time: Date.now().toString(),
        nonce: Math.random().toString(36).substring(7),
        origin: 'test',
        sessionId: 'test-session-' + Date.now(),
        signature: 'test-signature'
      })
    }
  }, [])

  // 应用模板
  const applyTemplate = (templateId: string) => {
    const template = promptTemplates.find(t => t.id === templateId)
    if (template) {
      setPrompt(template.prompt)
      setSelectedTemplate(templateId)
    }
  }

  // 生成图像
  const handleGenerate = async () => {
    if (!prompt.trim()) {
      setError('请输入提示词')
      return
    }

    if (prompt.trim().length < 5) {
      setError('提示词至少需要 5 个字符')
      return
    }

    if (!iframeParams) {
      setError('缺少会话参数，请刷新页面')
      return
    }

    setIsGenerating(true)
    setError(null)

    try {
      console.log('🚀 开始生成图像:', prompt.substring(0, 50) + '...')
      
      // 根据环境选择 API 端点
      const apiUrl = window.location.hostname === 'localhost' 
        ? '/api/generate'  // 本地开发使用 Vite 代理
        : 'https://nano-banana-generator-worker.cing-self.workers.dev/api/generate'  // 线上直接调用 Worker
      
      const response = await fetch(apiUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          prompt,
          ...iframeParams
        })
      })

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`)
      }

      const result: GenerateImageResponse = await response.json()

      if (result.success && result.data) {
        console.log('✅ 图像生成成功，消费:', result.data.creditsUsed, 'Credits')
        
        const newImage: GeneratedImage = {
          id: Date.now().toString(),
          prompt,
          imageData: result.data.imageData,
          timestamp: Date.now(),
          creditsUsed: result.data.creditsUsed
        }

        setCurrentImage(newImage)
        setHistory(prev => [newImage, ...prev].slice(0, 10)) // 最多保留10条历史
        setTotalCredits(prev => prev + (result.data?.creditsUsed || 0))
        setPrompt('') // 清空输入
        setSelectedTemplate('') // 重置模板选择
      } else {
        setError(result.error || '生成失败')
        console.error('❌ 生成失败:', result.error)
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : '网络错误，请重试'
      setError(message)
      console.error('❌ 请求异常:', err)
    } finally {
      setIsGenerating(false)
    }
  }

  // 查看历史图像
  const viewHistoryImage = (image: GeneratedImage) => {
    setSelectedHistoryImage(image)
    setDialogOpen(true)
  }

  // 下载图像
  const downloadImage = async (image: GeneratedImage) => {
    try {
      let blob: Blob
      
      // 判断是 URL 还是 Base64
      if (image.imageData.startsWith('http')) {
        // URL 格式：通过 Worker 代理下载
        console.log('📥 通过代理下载图像...')
        
        // 根据环境选择 API 端点
        const apiUrl = window.location.hostname === 'localhost' 
          ? '/api/download-image'  // 本地开发使用 Vite 代理
          : 'https://nano-banana-generator-worker.cing-self.workers.dev/api/download-image'  // 线上直接调用 Worker
        
        const response = await fetch(apiUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            imageUrl: image.imageData
          })
        })
        
        if (!response.ok) {
          throw new Error('代理下载失败')
        }
        
        blob = await response.blob()
      } else {
        // Base64 格式：直接转 Blob
        const base64Data = image.imageData.includes(',') 
          ? image.imageData.split(',')[1] 
          : image.imageData
        const binaryString = atob(base64Data)
        const bytes = new Uint8Array(binaryString.length)
        for (let i = 0; i < binaryString.length; i++) {
          bytes[i] = binaryString.charCodeAt(i)
        }
        blob = new Blob([bytes], { type: 'image/png' })
      }
      
      // 创建 Blob URL 并下载
      const blobUrl = URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = blobUrl
      link.download = `nano-banana-${image.id}.png`
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      
      // 释放 Blob URL
      setTimeout(() => URL.revokeObjectURL(blobUrl), 100)
      
      console.log('✅ 图像下载成功')
    } catch (err) {
      console.error('❌ 下载失败:', err)
      setError('下载失败，请重试')
    }
  }

  // 获取图像显示 URL
  const getImageUrl = (imageData: string) => {
    // 如果已经是 URL，直接返回
    if (imageData.startsWith('http')) {
      return imageData
    }
    // 否则当作 Base64 处理
    return `data:image/png;base64,${imageData}`
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 via-white to-blue-50">
      {/* Header */}
      <header className="border-b bg-white/80 backdrop-blur-sm sticky top-0 z-10">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Sparkles className="h-6 w-6 text-purple-600" />
              <h1 className="text-2xl font-bold bg-gradient-to-r from-purple-600 to-blue-600 bg-clip-text text-transparent">
                Nano Banana Image Generator
              </h1>
            </div>
            <div className="flex items-center gap-4">
              {iframeParams && (
                <Badge variant="outline" className="text-sm">
                  Session: {iframeParams.sessionId.substring(0, 8)}...
                </Badge>
              )}
              <Badge className="text-sm bg-gradient-to-r from-purple-600 to-blue-600">
                已消费: {totalCredits.toFixed(2)} Credits
              </Badge>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="container mx-auto px-4 py-8 max-w-6xl">
        <div className="grid gap-6 lg:grid-cols-2">
          {/* Left Column - Input */}
          <div className="space-y-6">
            {/* Prompt Input Card */}
            <Card>
              <CardHeader>
                <CardTitle>输入提示词</CardTitle>
                <CardDescription>描述您想要生成的图像</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Template Selector */}
                <div className="space-y-2">
                  <label className="text-sm font-medium">选择模板（可选）</label>
                  <Select value={selectedTemplate} onValueChange={applyTemplate}>
                    <SelectTrigger>
                      <SelectValue placeholder="选择一个提示词模板..." />
                    </SelectTrigger>
                    <SelectContent>
                      {promptTemplates.map(template => (
                        <SelectItem key={template.id} value={template.id}>
                          <div className="flex flex-col">
                            <span>{template.name}</span>
                            <span className="text-xs text-muted-foreground">
                              {template.description}
                            </span>
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Prompt Textarea */}
                <div className="space-y-2">
                  <label className="text-sm font-medium">提示词</label>
                  <Textarea
                    placeholder="例如: A beautiful sunset over the ocean with a sailboat..."
                    value={prompt}
                    onChange={(e) => setPrompt(e.target.value)}
                    rows={6}
                    className="resize-none"
                  />
                  <p className="text-xs text-muted-foreground">
                    {prompt.length} / 500 字符
                  </p>
                </div>

                {/* Action Buttons */}
                <div className="flex gap-2">
                  <Button
                    onClick={handleGenerate}
                    disabled={isGenerating || !prompt.trim()}
                    className="flex-1"
                  >
                    {isGenerating ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        生成中...
                      </>
                    ) : (
                      <>
                        <Sparkles className="mr-2 h-4 w-4" />
                        生成图像
                      </>
                    )}
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => {
                      setPrompt('')
                      setSelectedTemplate('')
                    }}
                    disabled={isGenerating}
                  >
                    清空
                  </Button>
                </div>
              </CardContent>
            </Card>

            {/* Error Alert */}
            {error && (
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertTitle>错误</AlertTitle>
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}
          </div>

          {/* Right Column - Image Display */}
          <div className="space-y-6">
            {/* Current Image Card */}
            <Card>
              <CardHeader>
                <CardTitle>生成结果</CardTitle>
                <CardDescription>
                  {currentImage ? '点击图像可放大查看' : '生成的图像将显示在这里'}
                </CardDescription>
              </CardHeader>
              <CardContent>
                {isGenerating ? (
                  <div className="space-y-3">
                    <Skeleton className="w-full aspect-square rounded-lg" />
                    <Skeleton className="h-4 w-3/4" />
                    <Skeleton className="h-4 w-1/2" />
                  </div>
                ) : currentImage ? (
                  <div className="space-y-3">
                    <div
                      className="relative aspect-square rounded-lg overflow-hidden cursor-pointer group"
                      onClick={() => viewHistoryImage(currentImage)}
                    >
                      <img
                        src={getImageUrl(currentImage.imageData)}
                        alt={currentImage.prompt}
                        className="w-full h-full object-cover transition-transform group-hover:scale-105"
                      />
                      <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition-colors flex items-center justify-center">
                        <ImageIcon className="text-white opacity-0 group-hover:opacity-100 transition-opacity" size={48} />
                      </div>
                    </div>
                    <div className="space-y-1">
                      <p className="text-sm font-medium">提示词:</p>
                      <p className="text-sm text-muted-foreground line-clamp-2">
                        {currentImage.prompt}
                      </p>
                      <div className="flex items-center justify-between pt-2">
                        <span className="text-xs text-muted-foreground">
                          {new Date(currentImage.timestamp).toLocaleString('zh-CN')}
                        </span>
                        <Badge variant="secondary">
                          {currentImage.creditsUsed.toFixed(2)} Credits
                        </Badge>
                      </div>
                      {/* 下载按钮 */}
                      <Button 
                        onClick={() => downloadImage(currentImage)} 
                        className="w-full mt-2"
                        variant="outline"
                      >
                        <Download className="mr-2 h-4 w-4" />
                        下载图像
                      </Button>
                    </div>
                  </div>
                ) : (
                  <div className="aspect-square rounded-lg border-2 border-dashed border-muted flex items-center justify-center">
                    <div className="text-center text-muted-foreground">
                      <ImageIcon className="mx-auto h-12 w-12 mb-2 opacity-50" />
                      <p className="text-sm">暂无图像</p>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* History */}
            {history.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle>历史记录</CardTitle>
                  <CardDescription>最近生成的图像</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-3 gap-2">
                    {history.map((image) => (
                      <div
                        key={image.id}
                        className="relative aspect-square rounded-lg overflow-hidden cursor-pointer group"
                        onClick={() => viewHistoryImage(image)}
                      >
                        <img
                          src={getImageUrl(image.imageData)}
                          alt={image.prompt}
                          className="w-full h-full object-cover transition-transform group-hover:scale-110"
                        />
                        <div className="absolute inset-0 bg-black/0 group-hover:bg-black/50 transition-colors flex items-center justify-center">
                          <ImageIcon className="text-white opacity-0 group-hover:opacity-100 transition-opacity" size={24} />
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t bg-white/80 backdrop-blur-sm mt-12">
        <div className="container mx-auto px-4 py-6 text-center text-sm text-muted-foreground">
          Powered by <span className="font-semibold text-purple-600">Nano Banana</span> × MuleRun Platform
        </div>
      </footer>

      {/* Image Preview Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-4xl">
          <DialogHeader>
            <DialogTitle>图像详情</DialogTitle>
          </DialogHeader>
          {selectedHistoryImage && (
            <div className="space-y-4">
              <img
                src={getImageUrl(selectedHistoryImage.imageData)}
                alt={selectedHistoryImage.prompt}
                className="w-full rounded-lg"
              />
              <div className="space-y-2">
                <p className="text-sm font-medium">提示词:</p>
                <p className="text-sm text-muted-foreground">
                  {selectedHistoryImage.prompt}
                </p>
                <div className="flex items-center justify-between pt-2 border-t">
                  <span className="text-xs text-muted-foreground">
                    {new Date(selectedHistoryImage.timestamp).toLocaleString('zh-CN')}
                  </span>
                  <Badge variant="secondary">
                    {selectedHistoryImage.creditsUsed.toFixed(2)} Credits
                  </Badge>
                </div>
                {/* 下载按钮 */}
                <Button 
                  onClick={() => downloadImage(selectedHistoryImage)} 
                  className="w-full mt-2"
                >
                  <Download className="mr-2 h-4 w-4" />
                  下载图像
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}

export default App
