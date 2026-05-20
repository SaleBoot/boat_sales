import { useEffect, useMemo, useRef, useState } from 'react'
import AdminPage from './pages/admin/AdminPage'
import OrderPage        from './pages/front/OrderPage'
import OrderSuccessPage from './pages/front/OrderSuccessPage'
import HomepageHeader       from './pages/front/homepage/HomepageHeader'
import HomePageHeroScreen   from './pages/front/homepage/HomePageHeroScreen'
import HomePageViewerScreen from './pages/front/homepage/HomePageViewerScreen'
import DetailSpecShowcase   from './pages/front/homepage/DetailSpecShowcase'
import DetailCompareStack   from './pages/front/homepage/DetailCompareStack'
import VideoShowcase        from './pages/front/homepage/VideoShowcase'
import ShipScene            from './pages/ShipScene'
import { useShowcaseData }                    from './hooks/useShowcaseData'
import { usePointerGlow,useGlobalMenuClose }  from './hooks/useUIEvents'
import {  
  vesselCategoryMenus
} from './constants/constants'

import {
  buildComparisonSpecSections,
  buildViewerSpecItems,
  getCategoryIdForModel,
  getModelDetailImageAssetPath,
  getModelDisplayLabel,
  getModelPriceLabel,
  getRouteFromHash,
  getRuntimeBasePath, 
  isCaptureModeEnabled,
  isVesselModel,
  normalizeHeroContent,
  normalizeSiteSettings, 
  getStaticAssetBaseUrl,
  normalizeCompareModelIds
} from './utils/utils_model'

 
// -------------------------------------------------------
export default function App() {
  const runtimeBasePath = getRuntimeBasePath()
  const staticAssetBaseUrl = getStaticAssetBaseUrl(
    // import.meta.env 专门用于获取项目的环境变量。
    // 动态适配环境：在本地开发时，VITE_STATIC_ASSET_ORIGIN 可能是空的，资源指向本地；在生产环境，它被替换为真正的 CDN 地址。
    import.meta.env.VITE_STATIC_ASSET_ORIGIN, // 传入 CDN 地址
    import.meta.env.BASE_URL  // 传入部署路径
  )

  const captureMode = isCaptureModeEnabled()
  const resolveStaticPath = (relativePath) => `${staticAssetBaseUrl}${relativePath}` 
  // ---------------------------------------
  // 在组件首次加载时，根据浏览器地址栏的 Hash（井号后面的内容）来确定初始路由状态。
  // 
  // window.location.hash 指的是 URL 中 # 及其后面的部分。
  // 例子：如果地址是 [https://example.com/#/profile](https://example.com/#/profile)，那么 hash 就是 "/#/profile"。
  // 
  // useState(() => ...) （核心重点）
  // 注意到 useState 里面传的不是一个普通的值，而是一个匿名函数。
  // 在 React 中，如果你给 useState 传递一个函数，React 只会在组件第一次渲染时执行这个函数，
  // 并将其返回值作为初始状态。
  // 为什么这么做？ 如果 getRouteFromHash 涉及复杂的字符串解析逻辑，直接写 useState(getRouteFromHash(...)) 
  // 会导致组件每次重新渲染时都重新执行这段解析逻辑。虽然 React 只会采纳第一次的结果，但计算过程被浪费了。
  // 使用函数式写法可以显著提升性能。
  const [route, setRoute] = useState(() => getRouteFromHash(window.location.hash))
  // 
  const [openCategoryId,      setOpenCategoryId]      = useState(null)
  const [openCompareSelectId, setOpenCompareSelectId] = useState(null)
  // --------------------------------------
  const { modelManifest, 
    siteContent, 
    selectedModelId, 
    setSelectedModelId 
  } = useShowcaseData( route, runtimeBasePath, staticAssetBaseUrl)

  usePointerGlow()

  useGlobalMenuClose(setOpenCategoryId, setOpenCompareSelectId)
  // ---------------------------------------
  // 派生状态与计算: 使用 useMemo 钩子来根据基础状态计算派生数据。
  // 例如，models 列表是根据 modelManifest 和 siteContent 计算得出的。modelsByCategory 则是根据 models 进一步处理成分类数据。
  const modelContentById = siteContent?.models ?? {}
  const models = useMemo(
    () => (modelManifest?.models ?? [])
      .filter(isVesselModel)
      .map((model) => {
        const content = modelContentById[model.id] ?? {}

        return {
          ...model,
          label: `${content.displayName ?? ''}`.trim() || model.label,
          type: `${content.type ?? ''}`.trim(),
          price: `${content.price ?? ''}`.trim(),
          specs: content.specs ?? {},
          engines: Array.isArray(content.engines) ? content.engines : [],
          detailImagePath: `${content.detailImagePath ?? ''}`.trim(),
          orderConfig: content.orderConfig ?? {},
          renderConfig: content.renderConfig ?? {}
        }
      }),
    [modelManifest, modelContentById]
  )

  const videos = siteContent?.videos ?? []
  const siteSettings = normalizeSiteSettings(siteContent?.settings)
  const heroContent = normalizeHeroContent(siteContent?.hero)

  const primaryModel = models.find((model) => model.id === selectedModelId) ?? null
  const selectedModelLabel = getModelDisplayLabel(primaryModel) || 
                            (models.length ? '\u9009\u62e9\u8239\u578b' // 选择船型
                                           : '\u6b63\u5728\u52a0\u8f7d\u8239\u578b') // 正在加载船型
  const selectedModelPriceLabel = getModelPriceLabel(primaryModel)
  const brochurePath = resolveStaticPath(siteSettings.brochurePath)
  const heroImagePath = resolveStaticPath(siteSettings.heroImagePath)
  const specImagePath = primaryModel
    ? resolveStaticPath(getModelDetailImageAssetPath(primaryModel))
    : ''
  const viewerSpecItems = buildViewerSpecItems(primaryModel)
  const primaryDetailSpecCards = buildComparisonSpecSections(primaryModel)

  // 使用 useMemo 钩子来根据基础状态计算派生数据。 
  // modelsByCategory 则是根据 models 进一步处理成分类数据。
  const modelsByCategory = useMemo(
    () => vesselCategoryMenus
      .map((category) => ({
        ...category,
        models: models.filter((model) => getCategoryIdForModel(model) === category.id)
      }))
      .filter((category) => category.models.length > 0),
    [models]
  )
   
  const maxCompareModelCount = siteSettings.compareLimit
  const activeCategoryId = primaryModel ? getCategoryIdForModel(primaryModel) : modelsByCategory[0]?.id ?? null

  useEffect(() => {
    const onHashChange = () => {
      setRoute(getRouteFromHash(window.location.hash))
    }

    onHashChange()
    window.addEventListener('hashchange', onHashChange)

    return () => {
      window.removeEventListener('hashchange', onHashChange)
    }
  }, [])
  

  const handleModelSelect = (modelId) => {
    if (!modelId || modelId === selectedModelId) {
      return
    }

    setSelectedModelId(modelId)
    window.localStorage.setItem(MODEL_STORAGE_KEY, modelId)
  }

  const scrollToExperience = () => {
    document.getElementById('experience')?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }

  const handleCompareSelectToggle = (modelId) => {
    if (!modelId) {
      return
    }

    setOpenCompareSelectId((current) => (current === modelId ? null : modelId))
  }
 

  

  

  if (route === 'admin') {
    return <AdminPage />
  }

  if (route === 'order') {
    return (
      <OrderPage
        models={models}
        primaryModel={primaryModel}
        selectedModelId={selectedModelId}
        onSelectModel={handleModelSelect}
        apiBasePath={runtimeBasePath}
      />
    )
  }

  if (route === 'order-success') {
    return <OrderSuccessPage />
  }

  if (captureMode) {
    return (
      <main className="capture-screen">
        <div className="capture-scene-shell">
          <ShipScene modelConfig={primaryModel} />
        </div>
      </main>
    )
  }

  return (
    <div className="page">
      <HomepageHeader
        modelsByCategory={modelsByCategory}
        activeCategoryId={activeCategoryId}
        openCategoryId={openCategoryId}
        setOpenCategoryId={setOpenCategoryId}
        handleModelSelect={handleModelSelect}
        scrollToExperience={scrollToExperience}
        selectedModelId={selectedModelId}
        brochurePath={brochurePath}
      />

      <main className="page-main" id="top">
        <HomePageHeroScreen 
          heroImagePath={heroImagePath}
          heroContent={heroContent}
          scrollToExperience={scrollToExperience}
        />

        <HomePageViewerScreen
          selectedModelId={selectedModelId}
          primaryModel={primaryModel}
          runtimeBasePath={runtimeBasePath}
          selectedModelLabel={selectedModelLabel}
          selectedModelPriceLabel={selectedModelPriceLabel}
          viewerSpecItems={viewerSpecItems}
        />

        <section className="detail-screen" id="details">
          <div className="detail-screen-inner">
            <DetailSpecShowcase
              specImagePath={specImagePath}
              selectedModelLabel={selectedModelLabel}
              selectedModelPriceLabel={selectedModelPriceLabel}
              primaryDetailSpecCards={primaryDetailSpecCards}
            />

            <DetailCompareStack
              models={models} 
              selectedModelId={selectedModelId}
              maxCompareModelCount={maxCompareModelCount}
              openCompareSelectId={openCompareSelectId}
              setOpenCompareSelectId={setOpenCompareSelectId}
              handleCompareSelectToggle={handleCompareSelectToggle}
              handleModelSelect={handleModelSelect}
              resolveStaticPath={resolveStaticPath}
            />

            <VideoShowcase videos={videos} />
          </div>
        </section>
      </main>

      <div className="mobile-cta">
        <a className="btn primary" href="#experience">查看 3D 船型</a>
      </div>
    </div>
  )
}