/**
 * 
这个脚本是一个验证工具，它的核心功能是检查 asset-manifest.json 中定义的模型材质绑定是否有效。

具体来说，它的工作流程是：
1.读取清单: 加载 public/gltf/asset-manifest.json 文件。
2.遍历模型和部件: 循环遍历清单中的每个模型及其包含的部件（parts）。
3.标准化材质名称:
    它从模型的运行时信息（runtime.materialSlots）中提取材质槽名称。
    使用 normalizeMaterialName 函数对这些名称进行标准化处理，例如转为小写、移除前缀 "m_"、并删除所有非字母数字字符。
4.验证 UV Set:
    对于每个模型的 UV Set（纹理坐标集），它会获取 materialNameHint（材质名称提示）。
    同样对 materialNameHint 进行标准化。
    检查标准化的 materialNameHint 是否存在于该模型标准化的材质槽名称集合中。
5.报告失败: 如果一个 UV Set 的 materialNameHint 在模型的材质槽中找不到匹配项，就记录一条失败信息。
6。输出结果: 如果有任何失败记录，脚本会打印所有错误信息并以失败状态退出；否则，它会打印一条成功消息。

这个脚本对于确保纹理能够正确应用到模型的特定部分至关重要
 * 
 * 
 */

import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

// --- 路径定义 ---
const scriptDir = path.dirname(fileURLToPath(import.meta.url))
// 定义 `asset-manifest.json` 文件的路径，这是脚本要验证的目标文件。
const manifestPath = path.resolve(scriptDir, '..', 'public', 'gltf', 'asset-manifest.json')

/**
 * 标准化材质名称。
 * 这个函数将材质名称转换为一个统一的、可比较的格式。
 * 转换规则：
 * 1. 转为小写。
 * 2. 移除任何以 "m" 开头，后跟下划线、空格或连字符的前缀（如 "m_", "m-", "m "）。
 * 3. 移除所有非字母数字的字符。
 * @param {string} value - 原始材质名称。
 * @returns {string} 标准化后的材质名称。
 */
const normalizeMaterialName = (value) => {
  if (!value) {
    return ''
  }

  return `${value}`
    .toLowerCase()
    .replace(/^m[_\s-]*/, '')
    .replace(/[^a-z0-9]+/g, '')
}

/**
 * 检查一个 UV Set 是否包含任何纹理贴图。
 * @param {object} uvSet - UV Set 对象。
 * @returns {boolean} 如果 UV Set 的 `textures` 字段不为空，则返回 true。
 */
const hasTextureMaps = (uvSet) => Object.keys(uvSet?.textures ?? {}).length > 0

// --- 主执行逻辑 ---

// 1. 读取并解析 `asset-manifest.json` 文件。
const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'))
const failures = [] // 用于存储验证失败的信息。

// 2. 遍历清单中的所有模型。
for (const model of manifest.models ?? []) {
  // 将模型本身及其所有部件（parts）收集到一个数组中进行统一处理。
  const nodes = [model, ...(model.parts ?? [])]

  for (const node of nodes) {
    const runtimeSlots = node.runtime?.materialSlots ?? []
    if (runtimeSlots.length === 0) {
      continue // 如果没有材质槽，则跳过。
    }

    // 3. 获取并标准化该节点（模型或部件）的所有材质槽名称。
    const normalizedSlots = new Set(
      runtimeSlots
        .map((slot) => `${slot?.normalizedName ?? ''}`.trim() || normalizeMaterialName(slot?.name))
        .filter(Boolean)
    )

    // 4. 遍历该节点的每个 UV Set，验证其材质绑定。
    for (const uvSet of node.uvSets ?? []) {
      // 如果 UV Set 没有任何纹理，则无需验证。
      if (!hasTextureMaps(uvSet)) {
        continue
      }

      // 标准化 UV Set 的 `materialNameHint`。
      const normalizedHint = normalizeMaterialName(uvSet.materialNameHint)
      // 如果 `materialNameHint` 存在，并且在标准化的材质槽名称集合中找不到匹配项，则记录为失败。
      if (!normalizedHint || normalizedSlots.has(normalizedHint)) {
        continue
      }

      failures.push(
        `${model.id}/${node.id}/${uvSet.id}: materialNameHint "${uvSet.materialNameHint}" does not match runtime slots [${Array.from(normalizedSlots).join(', ')}]`
      )
    }
  }
}

// 5. 根据验证结果输出信息。
if (failures.length > 0) {
  console.error(`[material-bindings] ${failures.length} broken material binding(s):`)
  for (const failure of failures) {
    console.error(`- ${failure}`)
  }
  process.exit(1) // 如果有失败项，以错误码 1 退出进程。
}

// 如果所有验证都通过，则输出成功信息。
console.log('[material-bindings] all textured UV sets match runtime material slots when slots are available')