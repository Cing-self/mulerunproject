import type { PromptTemplate } from '@/types/index'

export const promptTemplates: PromptTemplate[] = [
  {
    id: 'pixel-art',
    name: '像素艺术',
    prompt: 'A pixel-art style image of {subject}, retro game aesthetic, vibrant colors',
    category: 'art',
    description: '复古游戏风格的像素艺术图像'
  },
  {
    id: 'cyberpunk',
    name: '赛博朋克',
    prompt: 'A cyberpunk style {subject}, neon lights, futuristic cityscape, night scene',
    category: 'art',
    description: '科幻未来风格的霓虹场景'
  },
  {
    id: 'watercolor',
    name: '水彩画',
    prompt: 'A watercolor painting of {subject}, soft colors, artistic brushstrokes',
    category: 'art',
    description: '柔和艺术风格的水彩画'
  },
  {
    id: '3d-render',
    name: '3D 渲染',
    prompt: 'A 3D rendered {subject}, high quality, detailed textures, professional lighting',
    category: 'tech',
    description: '高质量三维渲染效果'
  },
  {
    id: 'minimalist',
    name: '简笔画',
    prompt: 'A minimalist line drawing of {subject}, simple and clean, black and white',
    category: 'art',
    description: '极简风格的黑白线条画'
  },
  {
    id: 'oil-painting',
    name: '油画风格',
    prompt: 'An oil painting of {subject}, classic art style, rich colors and textures',
    category: 'art',
    description: '古典艺术风格的油画'
  }
]
