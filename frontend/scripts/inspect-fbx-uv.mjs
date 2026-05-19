/**
 这个脚本 是一个简单而直接的FBX模型UV检查工具。它的逻辑非常清晰：
1.  **引入 `FBXLoader`**: 从 `three.js` 库中引入用于加载 FBX 模型的加载器。
2.  **硬编码模型路径**: 脚本中硬编码了一个本地文件路径 `file:///D:/Threejs/SalesBoat/gltf/Model314/1.fbx` 作为要检查的模型。
3.  **加载模型**: 使用 `FBXLoader` 异步加载指定的模型。
4.  **遍历与检查**:
    *   在加载成功的回调函数中，它会遍历模型场景图中的所有对象 (`object3d.traverse`)。
    *   它只关心网格对象 (`child.isMesh`)。
    *   对于每一个网格，它会检查其几何体属性 (`child.geometry.attributes`) 中是否存在 `uv`、`uv1` 和 `uv2` 这三个UV坐标集。
    *   它使用计数器来统计包含各个UV集的网格数量。
5.  **输出结果**: 遍历完成后，它会在控制台打印出总的网格数量，以及分别包含 `uv` (第一套UV)、`uv1` (第二套UV) 和 `uv2` (第三套UV) 的网格数量。
6.  **错误处理**: 如果加载失败，它会打印错误信息并设置进程退出码为1。
 * 
 */
import { FBXLoader } from 'three/examples/jsm/loaders/FBXLoader.js'

// 创建一个 FBX 加载器实例
const loader = new FBXLoader()
// **注意**: 这里硬编码了要检查的 FBX 模型的本地文件路径。
// 在使用前，需要将此路径修改为实际要检查的 FBX 文件路径。
const modelUrl = 'file:///D:/Threejs/SalesBoat/gltf/Model314/1.fbx'

console.log(`[inspect-fbx] 正在加载和检查模型: ${modelUrl}`)

// 使用加载器加载模型
loader.load(
  // 1. 模型 URL
  modelUrl,
  // 2. 加载成功后的回调函数
  (object3d) => {
    // 初始化计数器
    let meshCount = 0 // 总网格数
    let meshWithUv = 0 // 包含第一套 UV (uv) 的网格数
    let meshWithUv1 = 0 // 包含第二套 UV (uv1) 的网格数
    let meshWithUv2 = 0 // 包含第三套 UV (uv2) 的网格数

    // 遍历模型场景图中的所有子对象
    object3d.traverse((child) => {
      // 如果当前子对象不是一个网格 (Mesh)，则跳过
      if (!child.isMesh) {
        return
      }

      meshCount += 1
      // 获取网格几何体的所有属性 (attributes)
      const attrs = child.geometry?.attributes ?? {}
      // 检查是否存在 'uv' 属性
      if (attrs.uv) {
        meshWithUv += 1
      }
      // 检查是否存在 'uv1' 属性
      if (attrs.uv1) {
        meshWithUv1 += 1
      }
      // 检查是否存在 'uv2' 属性
      if (attrs.uv2) {
        meshWithUv2 += 1
      }
    })

    // 打印检查结果
    console.log('--- UV 检查结果 ---')
    console.log('总网格数量 (meshCount):', meshCount)
    console.log('包含 UV1 (uv) 的网格数:', meshWithUv)
    console.log('包含 UV2 (uv1) 的网格数:', meshWithUv1)
    console.log('包含 UV3 (uv2) 的网格数:', meshWithUv2)
    console.log('--------------------')
  },
  // 3. 加载进度回调 (此处未使用)
  undefined,
  // 4. 加载失败后的回调函数
  (error) => {
    console.error('加载或解析 FBX 模型失败:', error)
    process.exitCode = 1 // 设置进程退出码为 1，表示执行出错
  }
)