import {
  DEFAULT_HERO_CONTENT,
  DEFAULT_SITE_SETTINGS,
  NON_VESSEL_MODEL_IDS,
  legacyFallbackSpecs,
  modelSpecFieldLabels,
  modelSpecGroups,
  viewerSpecFields
} from '../constants/constants_front_homepage'

// 获取模型的显示名称。
export function getModelDisplayLabel(model) {
  if (!model) {
    return ''
  }

  if (model.label && model.label !== model.id) {
    return model.label
  }

  if (model.id === 'FireFighting') {
    return '\u6d88\u9632\u6551\u63f4\u8239' // 消防救援船
  }

  if (model.id === 'Cabnet') {
    return '\u516c\u52a1\u8239' // 公务船
  }

  return model.label
}
// 根据模型的属性判断它属于哪个分类。
export function getCategoryIdForModel(model) {
  const explicitType = `${model?.type ?? ''}`.trim()
  if (explicitType === '\u65b0\u80fd\u6e90\u8239') { // 新能源船  
    return 'NewEnergyShip'
  }

  if (explicitType === '\u5e94\u6025\u6551\u63f4\u8239') {//---  应急救援船  
    return 'EmergencyRescueShip'
  }

  if (explicitType === '\u516c\u52a1\u6267\u6cd5\u8247') {//---  公务执法艇 
    return 'OfficialLawEnforcementBoat'
  }

  if (explicitType === '\u6e38\u8247') {// ---  游艇
    return 'Yacht'
  }

  const rawLabel = `${model?.label ?? model?.id ?? ''}`.toLowerCase()
  const rawId = `${model?.id ?? ''}`.toLowerCase()

  if (rawLabel.includes('yacht') || rawId.includes('yacht') || rawLabel.includes('\u6e38\u8247')) {//// ---  游艇
    return 'yacht'
  }

  if (
    rawId.includes('fire') ||
    rawLabel.includes('fire') ||
    rawLabel.includes('rescue') ||
    rawLabel.includes('\u6551\u63f4') // 救援
  ) {
    return 'rescue'
  }

  if (
    rawId.includes('cabnet') ||
    rawId.includes('twolayer') ||
    rawLabel.includes('duty') ||
    rawLabel.includes('\u6267\u6cd5') ||  //执法
    rawLabel.includes('\u516c\u52a1') // 公务
  ) {
    return 'duty'
  }

  return 'new-energy'
}
// 从 URL 的 hash 中解析出当前应该显示的页面（如 admin, order）。
export function getRouteFromHash(hash) {
  if (hash === '#/admin' || hash.startsWith('#/admin?')) {
    return 'admin'
  }

  if (hash === '#/order' || hash.startsWith('#/order?')) {
    return 'order'
  }

  if (hash === '#/order-success' || hash.startsWith('#/order-success?')) {
    return 'order-success'
  }

  return 'showcase'
}

export function getRequestedModelId() {
  if (typeof window === 'undefined') {
    return ''
  }

  const searchParams = new URLSearchParams(window.location.search)
  return searchParams.get('model')?.trim() ?? ''
}

// 检查当前页面的 URL 参数中是否开启了“捕获模式”（Capture Mode）。
// 它通过判断 URL 中是否存在 capture=1 这个标记位来返回一个布尔值（true 或 false）。
export function isCaptureModeEnabled() {
  // 作用：判断代码是否在浏览器环境运行。
  // 场景：在 React（尤其是 Next.js 等框架）中，代码可能会在服务器端预执行。
  //      服务器端没有 window 对象，也没有 URL 地址栏，因此直接返回 false 避免报错。
  if (typeof window === 'undefined') {
    return false
  }

  // 解析 URL 查询参数
  //
  // window.location.search：获取 URL 中问号及其后面的部分。
  // 例如：https://example.com/page?id=123&capture=1 获取到 "?id=123&capture=1"。
  //
  // new URLSearchParams(...)：这是一个内置工具对象，专门用来解析和处理这些参数，让你能像查字典一样获取值。
  const searchParams = new URLSearchParams(window.location.search)
  return searchParams.get('capture') === '1'
}

export function getPlatformLabel(platform) {
  if (platform === 'youtube') {
    return 'YouTube'
  }

  if (platform === 'bilibili') {
    return 'Bilibili'
  }

  return platform || '\u672a\u77e5\u5e73\u53f0' //未知平台
}

// 这段代码就像一个“漏斗”，先把默认参数倒进去，再把用户自定义参数倒进去覆盖，最后产出一份绝对安全可用的数据。
export function getModelSpecs(model) {
  return {
    // (默认/旧版配置):首先把预定义的 legacyFallbackSpecs 里的所有参数放进去。
    // 作用：作为“兜底方案”。如果 model 里面缺少某些参数，就使用这些默认的旧版参数，确保程序不会因为缺少字段而崩溃。
    ...legacyFallbackSpecs,
    // (新版/具体配置)
    // ?. (可选链运算符)：它会检查 model 是否存在。如果 model 是 null 或 undefined，它会直接返回
    //        undefined 而不是报错（比如报错 "Cannot read property 'specs' of undefined"）。
    // ?? (空值合并运算符)：如果 model?.specs 的结果是 null 或 undefined，它就取后面那个空对象 {}。
    // 结果：这一整行确保了无论 model 存不存在，最终展开的要么是真实的规格数据，要么是一个空对象。
    ...(model?.specs ?? {})
  }
}
// 格式化价格显示。
// 将数字格式化为标准的中文货币（人民币）格式，并且不显示小数位。
// 它利用了浏览器原生内置的 Intl.NumberFormat 对象，这比手动拼接 ¥ 符号和处理逗号（千分位）要专业且可靠得多。
export function formatPrice(value) {
  return new Intl.NumberFormat('zh-CN', {
    style: 'currency',
    currency: 'CNY',
    maximumFractionDigits: 0 //表示不保留小数。如果输入的数字有小数（如 123.45），它会根据当地规则（通常是四舍五入）取整。
  }).format(Number(value) || 0)
}

// 从一个模型对象（model）中安全地提取并校验“参考价格”
// 在真实开发中，后端返回的数据往往是不可靠的。直接使用 `model.price` 可能会导致以下问题：
// 1. **UI 崩溃**：如果 `model` 没加载出来，访问 `model.price` 会直接让页面白屏。
// 2. **显示异常**：如果不校验 `amount <= 0`，页面上可能会显示 “价格：-100元” 这种荒谬的错误。
export function getModelReferencePrice(model) {
  const candidate = `${model?.price ?? ''}`.trim()
  if (!candidate) {
    return null
  }

  const amount = Number(candidate)
  if (!Number.isFinite(amount) || amount <= 0) {
    return null
  }

  return amount
}
// 格式化价格显示。
export function getModelPriceLabel(model) {
  const amount = getModelReferencePrice(model)
  if (amount === null) {
    return ''
  }

  return `\u53c2\u8003\u4ef7 ${formatPrice(amount)}`
}
// 格式化船只的具体规格值（例如，为长度加上 "m" 单位）。
export function formatModelSpecValue(fieldKey, rawValue) {
  const value = `${rawValue ?? ''}`.trim()
  if (!value) {
    return '\u5f85\u586b\u5199' // '待填写'
  }

  if (['overallLength', 'waterlineLength', 'beam', 'depth', 'draft'].includes(fieldKey)) {
    return `${value} m`
  }

  if (fieldKey === 'designSpeed') {
    return `\u2265 ${value} km/h` // ≥
  }

  if (fieldKey === 'ratedCapacity') {
    return `${value}\uff08\u542b\u8239\u5458\uff09` // （含船员）
  }

  return value
}
// 构建在 3D 查看器中显示的规格列表。
export function buildViewerSpecItems(model) {
  const specs = getModelSpecs(model)

  return viewerSpecFields.map((fieldKey) => ({
    label: modelSpecFieldLabels[fieldKey],
    value: formatModelSpecValue(fieldKey, specs[fieldKey])
  }))
}
// 构建用于对比页面的规格数据。
export function buildComparisonSpecSections(model) {
  const specs = getModelSpecs(model)

  return modelSpecGroups.map((group) => ({
    title: group.title,
    items: group.fields.map((fieldKey) => ({
      key: fieldKey,
      label: modelSpecFieldLabels[fieldKey],
      value: formatModelSpecValue(fieldKey, specs[fieldKey])
    }))
  }))
}

export function buildComparisonCardItems(model) {
  const specs = getModelSpecs(model)

  return modelSpecGroups.flatMap((group) => group.fields.map((fieldKey) => ({
    key: fieldKey,
    label: modelSpecFieldLabels[fieldKey],
    value: formatModelSpecValue(fieldKey, specs[fieldKey])
  })))
}
// 根据传入的模型对象（model），计算并返回该模型详情图片的完整存放路径。
export function getModelDetailImageAssetPath(model) {
  if (!model) {
    return ''
  }
  // encodeURIComponent(model.id): 对模型 ID 进行编码。这是为了防止 ID 中包含特殊字符（如 #, ?, &）导致浏览器解析 URL 出错。
  if (`${model.detailImagePath ?? ''}`.trim()) {
    return `gltf/${encodeURIComponent(model.id)}/${encodeRelativeAssetPath(model.detailImagePath)}`
  }

  return `gltf/${encodeURIComponent(model.id)}/tbrender.png`
}
// 安全地对一个相对路径进行 URL 编码。
export function encodeRelativeAssetPath(relativePath) {
  // `${relativePath ?? ''}`  防止输入是 null 或 undefined。如果是空值，则变成空字符串 ""。
  return `${relativePath ?? ''}`
    .split('/')  // 按照斜杠 / 把路径切成数组。
    // 过滤无效值:去掉数组中的“假值”（空字符串）。这能处理路径中多余的斜杠。
    // 例子："images//pic.png" 在拆分后会产生中间的空字符串 ""，过滤后只剩下 ["images", "pic.png"]。
    // 这保证了生成的路径不会出现 // 这种错误。
    .filter(Boolean) 
    // 作用：这是最关键的一步。它遍历路径的每一段，使用 encodeURIComponent 进行转码。
    // 原理：encodeURIComponent 会把非标准字符转换成 URL 安全的格式（例如空格变成 %20，中文变成 %E4%BD%A0...）。
    // 注意：为什么不直接对整个路径进行编码？ 因为如果直接编码整个路径，斜杠 / 也会被编码成 %2F，
    // 浏览器就无法识别这原本是一个路径层级了。所以必须先拆分，只编每一段的内容。    
    .map((segment) => encodeURIComponent(segment))
    .join('/')
}

// 一个典型的数据清洗（Data Sanitization）函数。它的作用是在一个“对比功能”中，确保你想要对比的
// 模型 ID 列表是合法、唯一、且不包含当前主选模型的。
// 这个函数逻辑拆解为：“建立白名单” -> “三重过滤” -> “数量截断”。
export function normalizeCompareModelIds(compareModelIds, // 用户尝试要对比的模型 ID 数组。
                                models, //合法模型对象的全量列表。
                                selectedModelId, // 当前已经选中的主模型 ID（通常对比功能是“主模型” vs “其他模型”，所以要把自己排除掉）。
                                maxCount = DEFAULT_SITE_SETTINGS.compareLimit) //最大对比数量限制（默认来自系统设置）。
{
  // 第一步：建立白名单 (Set)
  const validModelIds = new Set(models.map((model) => model.id))
  const nextIds = []

  // 第二步：三重过滤循环
  compareModelIds.forEach((modelId) => {
    if (!validModelIds.has(modelId) || //// 关卡 1：必须在合法白名单里（防止无效 ID）
        nextIds.includes(modelId) ||   // 关卡 2：不能重复（防止数组里有重复 ID）
        modelId === selectedModelId) { // 关卡 3：不能是当前已选中的主模型
      return  // 任何一关没过，直接跳过当前循环
    }

    nextIds.push(modelId)  // 全部通过，加入最终名单
  })

  // 第三步：限制长度 
  // 只截取前 maxCount 个。
  return nextIds.slice(0, maxCount)
}
// 判断一个模型是否是船只。
export function isVesselModel(model) {
  return model?.id && !NON_VESSEL_MODEL_IDS.has(model.id)
}

// 在实际项目中，后端 API 返回的数据往往不可靠（可能是 null、缺少字段或格式不统一）。这个函数的
// 作用是：接收一个原始的 hero 对象，将其转化为一个格式整齐、带有默认值、且可以直接给 React 组件使用的安全对象。
export function normalizeHeroContent(hero) {
  const proofPoints = Array.isArray(hero?.proofPoints)
    ? hero.proofPoints.map((item) => `${item ?? ''}`.trim()).filter(Boolean).slice(0, 3)
    : []

  return {
    kicker: `${hero?.kicker ?? ''}`.trim() || DEFAULT_HERO_CONTENT.kicker,
    heading: `${hero?.heading ?? ''}`.trim() || DEFAULT_HERO_CONTENT.heading,
    summary: `${hero?.summary ?? ''}`.trim() || DEFAULT_HERO_CONTENT.summary,
    proofPoints: proofPoints.length ? proofPoints : DEFAULT_HERO_CONTENT.proofPoints,
    primaryButtonLabel: `${hero?.primaryButtonLabel ?? ''}`.trim() || DEFAULT_HERO_CONTENT.primaryButtonLabel,
    secondaryButtonLabel: `${hero?.secondaryButtonLabel ?? ''}`.trim() || DEFAULT_HERO_CONTENT.secondaryButtonLabel,
    scrollCueLabel: `${hero?.scrollCueLabel ?? ''}`.trim() || DEFAULT_HERO_CONTENT.scrollCueLabel
  }
}

export function normalizeSiteSettings(settings) {
  const compareLimit = Number(settings?.compareLimit ?? DEFAULT_SITE_SETTINGS.compareLimit)
  return {
    primaryModelId: `${settings?.primaryModelId ?? DEFAULT_SITE_SETTINGS.primaryModelId}`.trim(),
    heroImagePath: `${settings?.heroImagePath ?? DEFAULT_SITE_SETTINGS.heroImagePath}`.trim() || DEFAULT_SITE_SETTINGS.heroImagePath,
    brochurePath: `${settings?.brochurePath ?? DEFAULT_SITE_SETTINGS.brochurePath}`.trim() || DEFAULT_SITE_SETTINGS.brochurePath,
    compareLimit: Math.max(1, Math.min(4, Number.isFinite(compareLimit) ? compareLimit : DEFAULT_SITE_SETTINGS.compareLimit))
  }
}

export function normalizeBasePath(basePath) {
  // 解释`${basePath ?? ''}`.trim()
  // ${...} (模板字符串)：强制将输入转换为字符串。即使你传入的是 null、undefined 或数字，它也会变成字符串。
  // ?? '' (空值合并运算符)：如果 basePath 是 null 或 undefined，则使用空字符串 ''。这能有效防止代码报错。
  // .trim()：切掉字符串两端的空格（例如 " /api " 变成 "/api"）。
  const normalizedValue = `${basePath ?? ''}`.trim()
  if (!normalizedValue) {
    // 如果处理后的字符串是空的（比如原始输入是 null、undefined 或者一堆空格），函数直接返回根路径 "/"。
    return '/'
  }
  // 补齐后缀斜杠
  return normalizedValue.endsWith('/') ? normalizedValue : `${normalizedValue}/`
}
// : 构建 API 请求的完整 URL。
export function buildApiUrl(basePath, path) {
  const normalizedBasePath = normalizeBasePath(basePath)
  // ${path ?? ''}: 同样是安全处理，防止 path 是 null 或 undefined。
  // .replace(/^\/+/, ''): 这是一个正则表达式清理。
  // ^：匹配字符串的开头。
  // \/+：匹配一个或多个斜杠 /。
  // 作用：如果 path 开头带了斜杠（比如 "/users"），它会把开头的斜杠删掉，变成 "users"。
  const normalizedPath = `${path ?? ''}`.replace(/^\/+/, '')
  return `${normalizedBasePath}${normalizedPath}`
}

// -------------------------------------
// -------------------------------------
// -------------------------------------

function assetBaseUrlFallback(baseUrl) {
  return baseUrl ?? '/'
}

export function normalizeBaseUrl(baseUrl) {
  const normalizedValue = `${baseUrl ?? ''}`.trim()
  if (!normalizedValue) {
    return '/'
  }

  return normalizedValue.endsWith('/') ? normalizedValue : `${normalizedValue}/`
}

export function getStaticAssetBaseUrl(staticAssetOrigin, fallbackBaseUrl) {
  const explicitOrigin = `${staticAssetOrigin ?? ''}`.trim()
  if (explicitOrigin) {
    return normalizeBaseUrl(explicitOrigin)
  }

  if (typeof window !== 'undefined') {
    const pathname = window.location.pathname || '/'
    const basePath = pathname.endsWith('/')
      ? pathname
      : pathname.slice(0, pathname.lastIndexOf('/') + 1)

    return normalizeBaseUrl(basePath || '/')
  }

  return normalizeBaseUrl(assetBaseUrlFallback(fallbackBaseUrl))
}
// 动态获取当前网页在浏览器中运行时的“基础路径”。
// 它通常用于多级路由或前端部署在子目录（例如 [https://example.com/app/dashboard](https://example.com/app/dashboard)）
// 的场景，确保程序能知道自己处于哪个“层级”。
export function getRuntimeBasePath() {
  // React 项目经常涉及 服务端渲染 (SSR)（如 Next.js）。在服务器端运行 JS 时没有浏览器窗口，
  // 代码会报错。如果是服务器环境，直接返回默认根路径 /。
  if (typeof window === 'undefined') {
    return '/'
  }

  // 作用：获取浏览器地址栏中域名后面的部分。
  // 例子：如果地址是 [https://site.com/blog/article-1](https://site.com/blog/article-1)，
  //     那么 pathname 就是 "/blog/article-1"。  
  const pathname = window.location.pathname || '/'
  const basePath = pathname.endsWith('/')
    ? pathname
    : pathname.slice(0, pathname.lastIndexOf('/') + 1)

  return normalizeBaseUrl(basePath || '/')
}

export  const resolveManifestPath = (assetPath) => {
    if (!assetPath) {
      return ''
    }
    // 绝对地址检查（网络路径）
    // 正则表达式：^https?:\/\/ 匹配以 http:// 或 https:// 开头的字符串（不区分大小写）。
    // 逻辑：如果这个资源已经是完整的网络地址了（比如已经在 CDN 上或引用的是外部图片），那就原样返回，不要再折腾它。
    if (/^https?:\/\//i.test(assetPath)) {
      return assetPath
    }

    // 
    if (assetPath.startsWith('/')) {
      // 为了拼接到 assetBaseUrl（通常以 / 结尾）后面，代码使用 slice(1) 删掉了 assetPath 开头的斜杠。
      return `${assetBaseUrl}${assetPath.slice(1)}`
    }

    return `${assetBaseUrl}${assetPath}`
  }