/*
这个脚本的功能非常清晰：它负责将预定义的模型详情图片路径，合并到 site-content.json 这个核心数据文件中。

具体流程如下：
定义路径: 确定 site-content.json 文件的绝对路径。
定义图片映射: 创建一个名为 detailImagePathByModelId 的对象，硬编码了每个模型 ID (如 PleasureBoat1)
            对应的详情图片文件名 (如 1.png)。
读取和更新: 读取 site-content.json 文件，然后遍历 detailImagePathByModelId 对象，将每个模型的
          详情图片路径更新或添加到 site-content.json 的 models 字段下。
写回文件: 将更新后的内容写回 site-content.json 文件。
*/ 
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

// --- 路径定义 ---
// 获取当前脚本所在的目录。
const scriptDir = path.dirname(fileURLToPath(import.meta.url))
// 获取前端项目的根目录。
const frontendDir = path.resolve(scriptDir, '..')
// 获取整个代码仓库的根目录。
const repoRoot = path.resolve(frontendDir, '..')
// 定义 `site-content.json` 文件的绝对路径，这是脚本要操作的目标文件。
const siteContentPath = path.resolve(repoRoot, 'data', 'site-content.json')

/**
 * 定义每个模型 ID 对应的详情图片路径。
 * 这是一个硬编码的映射表，key 是模型 ID，value 是图片文件名。
 * 这些图片路径将被合并到 `site-content.json` 文件中。
 */
const detailImagePathByModelId = {
  Cabnet: 'render-card.png',
  FireFighting: 'tbrender.png',
  LiuYun: 'tbrender.png',
  PleasureBoat: 'render-card.png',
  PleasureBoat1: '1.png',
  TestHigh: 'tbrender.png',
  TwoLayerBoat: 'render-card.png',
  Yacht: '1.png'
}

// --- 主执行逻辑 ---

// 1. 检查 `site-content.json` 文件是否存在，如果不存在则报错并退出。
if (!fs.existsSync(siteContentPath)) {
  console.error(`[merge:detail-images] Missing site content file: ${siteContentPath}`)
  process.exit(1)
}

// 2. 读取并解析 `site-content.json` 文件。
const raw = JSON.parse(fs.readFileSync(siteContentPath, 'utf8'))
const nextContent = {
  ...raw,
  updatedAt: new Date().toISOString(), // 更新时间戳
  models: {
    ...(raw.models ?? {})
  }
}

// 3. 遍历预定义的图片映射表，将详情图片路径合并到 `nextContent` 对象中。
for (const [modelId, detailImagePath] of Object.entries(detailImagePathByModelId)) {
  const currentModel = nextContent.models[modelId] ?? {}
  nextContent.models[modelId] = {
    ...currentModel,
    detailImagePath // 添加或覆盖 detailImagePath 字段
  }
}

// 4. 将更新后的 `nextContent` 对象写回 `site-content.json` 文件。
fs.writeFileSync(siteContentPath, `${JSON.stringify(nextContent, null, 2)}\n`, 'utf8')

// 5. 在控制台输出成功信息。
console.log(`[merge:detail-images] Updated detailImagePath for ${Object.keys(detailImagePathByModelId).length} model(s).`)