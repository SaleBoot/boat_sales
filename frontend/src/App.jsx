import { useEffect, useMemo, useRef, useState } from 'react'
import AdminPage from './AdminPage'
import OrderPage from './OrderPage'
import OrderSuccessPage from './OrderSuccessPage'
import ShipScene from './ShipScene'
import {
  DEFAULT_HERO_CONTENT,
  DEFAULT_SITE_SETTINGS, 
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
  const resolveApiPath = (relativePath) => `${runtimeBasePath}${relativePath}`
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
  const [isScrolled, setIsScrolled] = useState(false)
  const [sceneViewToggleTarget, setSceneViewToggleTarget] = useState(null)
  const [openCategoryId, setOpenCategoryId] = useState(null)
  const [openCompareSelectId, setOpenCompareSelectId] = useState(null)
  const [modelManifest, setModelManifest] = useState(null)
  //  (当前选中的船型),
  const [selectedModelId, setSelectedModelId] = useState('')
  const [viewerFocusTarget, setViewerFocusTarget] = useState('exterior')
  //  (用于对比的船型列表),
  const [compareModelIds, setCompareModelIds] = useState([])
  // 从 API 获取的网站内容
  const [siteContent, setSiteContent] = useState({ settings: DEFAULT_SITE_SETTINGS, hero: DEFAULT_HERO_CONTENT, videos: [], models: {} })
  const [viewerFocusTargets, setViewerFocusTargets] = useState({})
  const [enteringCompareModelId, setEnteringCompareModelId] = useState('')
  // ---------------------------------------
  // 使用 useRef 来引用 DOM 元素，如 viewerScreenRef。
  const viewerScreenRef = useRef(null)

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
  
  const compareModels = useMemo(
    () => compareModelIds
      .map((modelId) => models.find((model) => model.id === modelId) ?? null)
      .filter(Boolean),// callback
    [compareModelIds, models] // 依赖数租
  )
  const maxCompareModelCount = siteSettings.compareLimit
  const activeCategoryId = primaryModel ? getCategoryIdForModel(primaryModel) : modelsByCategory[0]?.id ?? null

  useEffect(() => {
    setViewerFocusTarget('exterior')
  }, [selectedModelId])

  useEffect(() => {
    if (!selectedModelId) {
      setViewerFocusTargets({})
      return
    }

    let cancelled = false

    const loadFocusTargets = async () => {
      try {
        const response = await fetch(
            buildApiUrl(runtimeBasePath, `api/models/${encodeURIComponent(selectedModelId)}/focus-targets`) )
        if (!response.ok) {
          throw new Error(`Failed to load focus targets: ${response.status}`)
        }

        const payload = await response.json()
        if (!cancelled) {
          setViewerFocusTargets(payload?.focusTargets ?? {})
        }
      } catch (error) {
        console.error(`Failed to load focus targets for ${selectedModelId}:`, error)
        if (!cancelled) {
          setViewerFocusTargets(primaryModel?.orderConfig?.focusTargets ?? {})
        }
      }
    }

    loadFocusTargets()

    return () => {
      cancelled = true
    }
  }, [primaryModel?.orderConfig?.focusTargets, runtimeBasePath, selectedModelId])

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

  useEffect(() => {
    if (route === 'admin') {
      setIsScrolled(false)
      return undefined
    }

    const onScroll = () => {
      setIsScrolled(window.scrollY > 12)
    }

    onScroll()
    window.addEventListener('scroll', onScroll, { passive: true })

    return () => {
      window.removeEventListener('scroll', onScroll)
    }
  }, [route])

  useEffect(() => {
    let animationFrameId = 0

    const updatePointerGlow = (event) => {
      if (animationFrameId) {
        window.cancelAnimationFrame(animationFrameId)
      }

      animationFrameId = window.requestAnimationFrame(() => {
        document.documentElement.style.setProperty('--cursor-x', `${event.clientX}px`)
        document.documentElement.style.setProperty('--cursor-y', `${event.clientY}px`)
      })
    }

    window.addEventListener('pointermove', updatePointerGlow, { passive: true })

    return () => {
      if (animationFrameId) {
        window.cancelAnimationFrame(animationFrameId)
      }

      window.removeEventListener('pointermove', updatePointerGlow)
    }
  }, [])

  useEffect(() => {
    if (route === 'admin') {
      return undefined
    }

    let isCancelled = false

    const loadShowcaseData = async () => {
      try {
        const manifestUrl = resolveStaticPath('gltf/asset-manifest.json')
        const contentUrl = resolveApiPath('api/site-content')

        const [manifestResponse, contentResponse] = await Promise.all([
          fetch(manifestUrl, { cache: 'no-store' }),
          fetch(contentUrl, { cache: 'no-store' }).catch(() => null)
        ])

        if (!manifestResponse.ok) {
          throw new Error(`Failed to fetch asset-manifest.json: ${manifestResponse.status}`)
        }

        const manifest = await manifestResponse.json()
        const content = contentResponse?.ok
          ? await contentResponse.json()
          : { settings: DEFAULT_SITE_SETTINGS, hero: DEFAULT_HERO_CONTENT, videos: [], models: {} }
        if (isCancelled) {
          return
        }

        setModelManifest(manifest)
        setSiteContent(content ?? { settings: DEFAULT_SITE_SETTINGS, hero: DEFAULT_HERO_CONTENT, videos: [], models: {} })

        const vesselManifestModels = (manifest.models ?? []).filter(isVesselModel)
        const availableIds = new Set(vesselManifestModels.map((model) => model.id))
        const requestedModelId = getRequestedModelId()
        const storedModelId = window.localStorage.getItem(MODEL_STORAGE_KEY)
        const persistedModelId = storedModelId && availableIds.has(storedModelId)
          ? storedModelId
          : ''
        const queryModelId = requestedModelId && availableIds.has(requestedModelId)
          ? requestedModelId
          : ''
        const configuredPrimaryModelId = `${content?.settings?.primaryModelId ?? ''}`.trim()
        const defaultModelId = configuredPrimaryModelId && availableIds.has(configuredPrimaryModelId)
          ? configuredPrimaryModelId
          : availableIds.has(manifest.primaryModelId)
          ? manifest.primaryModelId
          : vesselManifestModels[0]?.id ?? ''
        const preferredModelId = availableIds.has(PREFERRED_MODEL_ID) ? PREFERRED_MODEL_ID : ''
        const initialModelId = queryModelId || persistedModelId || defaultModelId || preferredModelId

        setSelectedModelId(initialModelId)

        if (initialModelId) {
          window.localStorage.setItem(MODEL_STORAGE_KEY, initialModelId)
        }
      } catch (error) {
        console.error('Failed to load showcase data:', error)
      }
    }

    loadShowcaseData()

    return () => {
      isCancelled = true
    }
  }, [route])

  useEffect(() => {
    if (route !== 'showcase' || !viewerScreenRef.current) {
      return undefined
    }

    const viewerScreen = viewerScreenRef.current
    let frameId = 0

    const updateViewerScaleProgress = () => {
      frameId = 0

      const rect = viewerScreen.getBoundingClientRect()
      const viewportHeight = window.innerHeight || 1
      const scrollSpan = Math.max(rect.height - viewportHeight, 1)
      const revealProgress = Math.min(Math.max((-rect.top) / scrollSpan, 0), 1)

      viewerScreen.style.setProperty('--viewer-scroll-progress', revealProgress.toFixed(3))
    }

    const requestUpdate = () => {
      if (frameId) {
        return
      }

      frameId = window.requestAnimationFrame(updateViewerScaleProgress)
    }

    requestUpdate()
    window.addEventListener('scroll', requestUpdate, { passive: true })
    window.addEventListener('resize', requestUpdate)

    return () => {
      if (frameId) {
        window.cancelAnimationFrame(frameId)
      }

      window.removeEventListener('scroll', requestUpdate)
      window.removeEventListener('resize', requestUpdate)
    }
  }, [route])

  useEffect(() => {
    const closeMenusOnOutsideInteraction = (event) => {
      if (
        !(event.target instanceof Element) ||
        event.target.closest('.site-category-group') ||
        event.target.closest('.detail-compare-select-group')
      ) {
        return
      }

      setOpenCategoryId(null)
      setOpenCompareSelectId(null)
    }

    const closeMenusOnEscape = (event) => {
      if (event.key === 'Escape') {
        setOpenCategoryId(null)
        setOpenCompareSelectId(null)
      }
    }

    document.addEventListener('pointerdown', closeMenusOnOutsideInteraction)
    document.addEventListener('keydown', closeMenusOnEscape)

    return () => {
      document.removeEventListener('pointerdown', closeMenusOnOutsideInteraction)
      document.removeEventListener('keydown', closeMenusOnEscape)
    }
  }, [])

  useEffect(() => {
    setCompareModelIds((current) => normalizeCompareModelIds(current, models, selectedModelId, maxCompareModelCount))
  }, [models, selectedModelId, maxCompareModelCount])

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

  const handleCategoryTriggerClick = (category) => {
    if (!category) {
      return
    }

    if (category.models.length === 1) {
      handleModelSelect(category.models[0].id)
      setOpenCategoryId(null)
      scrollToExperience()
      return
    }

    setOpenCategoryId((current) => (current === category.id ? null : category.id))
    scrollToExperience()
  }

  const handleCategoryItemClick = (modelId) => {
    handleModelSelect(modelId)
    setOpenCategoryId(null)
    scrollToExperience()
  }

  const handleCompareSelectToggle = (modelId) => {
    if (!modelId) {
      return
    }

    setOpenCompareSelectId((current) => (current === modelId ? null : modelId))
  }

  const handleCompareToggle = (modelId) => {
    if (!modelId) {
      return
    }

    setCompareModelIds((current) => {
      if (current.includes(modelId)) {
        return current.filter((currentId) => currentId !== modelId)
      }

      if (current.length >= maxCompareModelCount) {
        return current
      }

      return normalizeCompareModelIds([...current, modelId], models, selectedModelId, maxCompareModelCount)
    })
  }

  const handleAddCompareCard = () => {
    setCompareModelIds((current) => {
      if (current.length >= maxCompareModelCount) {
        return current
      }

      const usedIds = new Set([selectedModelId, ...current])
      const nextModel = models.find((model) => !usedIds.has(model.id))
      if (!nextModel) {
        return current
      }

      setEnteringCompareModelId(nextModel.id)
      return normalizeCompareModelIds([...current, nextModel.id], models, selectedModelId, maxCompareModelCount)
    })
  }

  useEffect(() => {
    if (!enteringCompareModelId) {
      return undefined
    }

    const timerId = window.setTimeout(() => {
      setEnteringCompareModelId((current) => (current === enteringCompareModelId ? '' : current))
    }, 540)

    return () => {
      window.clearTimeout(timerId)
    }
  }, [enteringCompareModelId])

  const handleCompareModelChange = (currentModelId, nextModelId) => {
    if (!currentModelId || !nextModelId || nextModelId === selectedModelId) {
      return
    }

    setOpenCompareSelectId(null)

    setCompareModelIds((current) => {
      if (!current.includes(currentModelId)) {
        return current
      }

      if (current.includes(nextModelId) && nextModelId !== currentModelId) {
        return current
      }

      return current.map((modelId) => (modelId === currentModelId ? nextModelId : modelId))
    })
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
      <header className={`site-nav ${isScrolled ? 'is-scrolled' : ''}` }>
        <div className="site-nav-inner">
          <div className="site-nav-left">
            <nav className="site-categories" aria-label="船型分类">
              {modelsByCategory.map((category) => {
                const isActiveCategory = category.id === activeCategoryId
                const isOpen = openCategoryId === category.id

                return (
                  <div
                    key={category.id}
                    className={`site-category-group ${isActiveCategory ? 'is-active' : ''} ${isOpen ? 'is-open' : ''}`}
                    onMouseEnter={() => setOpenCategoryId(category.id)}
                    onMouseLeave={() => setOpenCategoryId((current) => (current === category.id ? null : current))}
                  >
                    <button
                      type="button"
                      className="site-category-trigger"
                      onClick={() => handleCategoryTriggerClick(category)}
                      aria-expanded={isOpen}
                      aria-haspopup="menu"
                    >
                      <span>{category.label}</span>
                      <span className="site-category-caret" aria-hidden="true">▾</span>
                    </button>

                    <div className="site-category-dropdown" role="menu" aria-label={category.label}>
                      {category.models.map((model) => {
                        const isActiveModel = model.id === selectedModelId

                        return (
                          <button
                            key={model.id}
                            type="button"
                            className={`site-category-option ${isActiveModel ? 'active' : ''}`}
                            onClick={() => handleCategoryItemClick(model.id)}
                            role="menuitem"
                          >
                            <span>{getModelDisplayLabel(model)}</span>
                          </button>
                        )
                      })}
                    </div>
                  </div>
                )
              })}
            </nav>
          </div>

          <a className="brand" href="#top">京穗船舶</a>

          <div className="site-nav-right">
            <nav className="site-links" aria-label="主导航">
              <a href="#poster">首页</a>
              <a href="#experience">3D 看船</a>
              <a href="#details">参数对比</a>
              <a href="#/admin">后台管理</a>
            </nav>
            <a className="mini-btn" href={brochurePath} download>下载资料</a>
          </div>
        </div>
      </header>

      <main className="page-main" id="top">
        <section className="hero-screen" id="poster">
          <img className="hero-poster" src={heroImagePath} alt="京穗船舶产品展示图" />
          <div className="hero-overlay" />
          <div className="hero-aurora" aria-hidden="true">
            <span className="hero-aurora-orb hero-aurora-orb-1" />
            <span className="hero-aurora-orb hero-aurora-orb-2" />
            <span className="hero-aurora-ring" />
          </div>

          <div className="hero-content">
            <p className="hero-kicker reveal reveal-1">{heroContent.kicker}</p>
            <h1 className="reveal reveal-2">{heroContent.heading}</h1>
            <p className="hero-slogan reveal reveal-3">{heroContent.summary}</p>
            <div className="hero-proof-strip reveal reveal-4" aria-label="平台能力">
              {heroContent.proofPoints.map((item) => (
                <span key={item}>{item}</span>
              ))}
            </div>
            <div className="hero-actions reveal reveal-4">
              <a className="btn primary" href="#experience">{heroContent.primaryButtonLabel}</a>
              <a className="btn order-btn" href="#/order">{heroContent.secondaryButtonLabel}</a>
            </div>
          </div>

          <a className="scroll-cue reveal reveal-4" href="#experience">
            <span className="scroll-cue-line" />
            <span>{heroContent.scrollCueLabel}</span>
          </a>
        </section>

        <section className="viewer-screen" id="experience" ref={viewerScreenRef}>
          <div className="viewer-canvas viewer-canvas-fullscreen">
            <div className="viewer-canvas-toolbar">
              <div className="viewer-spec-card">
                <div className="viewer-spec-topbar">
                  <div className="viewer-spec-topbar-copy">
                    <p className="viewer-control-title">{selectedModelLabel}</p>
                    {selectedModelPriceLabel && (
                      <p className="viewer-control-price">{selectedModelPriceLabel}</p>
                    )}
                  </div>
                  <div className="viewer-scene-toggle-slot" ref={setSceneViewToggleTarget} />
                </div>
                <div className="viewer-spec-header">
                  <p className="viewer-control-title">{selectedModelLabel}</p>
                </div>

                <div className="viewer-spec-grid" role="list" aria-label={`${selectedModelLabel} 主要参数`}>
                  {viewerSpecItems.map((item) => (
                    <div key={item.label} className="viewer-spec-item" role="listitem">
                      <span className="viewer-spec-label">{item.label}</span>
                      <strong className="viewer-spec-value">{item.value}</strong>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <ShipScene
              modelConfig={primaryModel}
              viewTogglePortalTarget={sceneViewToggleTarget}
              focusTarget={viewerFocusTarget}
              focusTargetPresets={viewerFocusTargets}
              focusTargetStrategy="console-driven"
              onFocusTargetChange={setViewerFocusTarget}
            />
          </div>
        </section>

        <section className="detail-screen" id="details">
          <div className="detail-screen-inner">
            <section className="detail-spec-showcase" aria-label="主要技术参数">
              <div className="detail-spec-combined-card">
                <div className="detail-spec-visual">
                  {specImagePath && (
                    <img
                      className="detail-spec-image"
                      src={specImagePath}
                      alt={`${selectedModelLabel} 渲染图`}
                      loading="lazy"
                      decoding="async"
                    />
                  )}
                </div>

                <div className="detail-spec-panel">
                  <div className="detail-spec-head">
                    <p className="detail-card-eyebrow">技术概览</p>
                    <h3>{selectedModelLabel} 参数与方案概览</h3>
                    {selectedModelPriceLabel && (
                      <p className="detail-spec-price">{selectedModelPriceLabel}</p>
                    )}
                    <p>围绕总长、吃水、主机功率等关键指标展示，便于快速完成船型初筛、方案沟通与多型号对比。</p>
                  </div>

                  <div className="detail-spec-card-grid">
                    {primaryDetailSpecCards.map((card) => (
                      <article key={card.title} className="detail-spec-card">
                        <h4>{card.title}</h4>
                        <div className="detail-spec-table" role="table" aria-label={card.title}>
                          {card.items.map((item) => (
                            <div key={item.key} className="detail-spec-row" role="row">
                              <span className="detail-spec-label" role="cell">{item.label}</span>
                              <strong className="detail-spec-value" role="cell">{item.value}</strong>
                            </div>
                          ))}
                        </div>
                      </article>
                    ))}
                  </div>
                </div>
              </div>
            </section>

            <section className="detail-compare-stack" aria-label="对比卡片">
              <div className="detail-compare-toolbar">
                <div>
                  <p className="detail-card-eyebrow">方案对比</p>
                  <h4 className="detail-compare-heading">最多四型同屏对比</h4>
                </div>

                <div className="detail-compare-toolbar-actions">
                  <p className="detail-compare-status">{`已加入 ${compareModels.length} / ${maxCompareModelCount} 个船型`}</p>
                  <button
                    type="button"
                    className="mini-btn detail-compare-add-btn"
                    onClick={handleAddCompareCard}
                    disabled={compareModels.length >= maxCompareModelCount || models.length <= compareModels.length + 1}
                  >
                    添加对比船型
                  </button>
                </div>
              </div>

              {compareModels.length > 0 ? (
                <div
                  className="detail-compare-grid"
                  style={{
                    '--compare-columns': `${Math.max(2, Math.min(compareModels.length, maxCompareModelCount))}`
                  }}
                >
                  {compareModels.map((model) => {
                    const cardItems = buildComparisonCardItems(model)
                    const compareImagePath = resolveStaticPath(getModelDetailImageAssetPath(model))
                    const comparePriceLabel = getModelPriceLabel(model)
                    const isCompareSelectOpen = openCompareSelectId === model.id
                    const selectableModels = models.filter((candidate) => (
                      candidate.id !== selectedModelId &&
                      (candidate.id === model.id || !compareModelIds.includes(candidate.id))
                    ))

                    return (
                      <article
                        key={model.id}
                        className={`detail-compare-card ${enteringCompareModelId === model.id ? 'is-entering' : ''}`}
                      >
                        {compareImagePath && (
                          <div className="detail-compare-image-shell">
                            <img
                              className="detail-compare-image"
                              src={compareImagePath}
                              alt={`${getModelDisplayLabel(model)} ${'\u7565\u7f29\u56fe'}`}
                              loading="lazy"
                            />
                          </div>
                        )}

                        <div className="detail-compare-card-head">
                          <div>
                            <p className="detail-compare-card-kicker">{model.type || '船型对比'}</p>
                            <h4>{getModelDisplayLabel(model)}</h4>
                            {comparePriceLabel && (
                              <p className="detail-compare-card-price">{comparePriceLabel}</p>
                            )}
                            <div className="detail-compare-select-wrap">
                              <span className="detail-compare-select-label">切换对比船型</span>
                              <div
                                className={`detail-compare-select-group ${isCompareSelectOpen ? 'is-open' : ''}`}
                                onMouseEnter={() => setOpenCompareSelectId(model.id)}
                                onMouseLeave={() => setOpenCompareSelectId((current) => (current === model.id ? null : current))}
                              >
                                <button
                                  type="button"
                                  className="detail-compare-select-trigger"
                                  onClick={() => handleCompareSelectToggle(model.id)}
                                  aria-expanded={isCompareSelectOpen}
                                  aria-haspopup="menu"
                                >
                                  <span>{getModelDisplayLabel(model)}</span>
                                  <span className="detail-compare-select-caret" aria-hidden="true">▾</span>
                                </button>

                                <div className="detail-compare-select-dropdown" role="menu" aria-label="船型选择">
                                  {selectableModels.map((candidate) => {
                                    const isActiveCandidate = candidate.id === model.id

                                    return (
                                      <button
                                        key={candidate.id}
                                        type="button"
                                        className={`detail-compare-select-option ${isActiveCandidate ? 'active' : ''}`}
                                        onClick={() => handleCompareModelChange(model.id, candidate.id)}
                                        role="menuitem"
                                      >
                                        <span>{getModelDisplayLabel(candidate)}</span>
                                      </button>
                                    )
                                  })}
                                </div>
                              </div>
                            </div>
                          </div>

                          <div className="detail-compare-card-actions">
                            <button
                              type="button"
                              className="mini-btn detail-compare-focus-btn"
                              onClick={() => handleModelSelect(model.id)}
                            >
                              {'\u8bbe\u4e3a\u4e3b\u5c55\u793a'}
                            </button>
                            <button
                              type="button"
                              className="mini-btn detail-compare-remove-btn"
                              onClick={() => handleCompareToggle(model.id)}
                            >
                              {'\u79fb\u9664'}
                            </button>
                          </div>
                        </div>

                        <div className="detail-spec-table" role="table" aria-label={`${getModelDisplayLabel(model)} ${'\u5bf9\u6bd4\u53c2\u6570'}` }>
                          {cardItems.map((item) => (
                            <div key={item.key} className="detail-spec-row" role="row">
                              <span className="detail-spec-label" role="cell">{item.label}</span>
                              <strong className="detail-spec-value" role="cell">{item.value}</strong>
                            </div>
                          ))}
                        </div>
                      </article>
                    )
                  })}
                </div>
              ) : (
                <div className="detail-compare-empty">
                  <p>添加对比船型后，可在同一视图内并排查看最多 4 个型号的关键参数、参考价格与外观缩略图。</p>
                </div>
              )}
            </section>

            {videos.length > 0 && (
              <section className="video-showcase" aria-label="外部视频展示">
                <div className="video-section-header">
                  <div>
                    <p className="detail-kicker">影像资料</p>
                    <h3>航行与任务场景视频</h3>
                  </div>
                  <p className="video-section-copy">
                    通过航行、靠泊、任务执行与细节镜头，辅助客户理解船型在真实使用场景中的状态与质感。
                  </p>
                </div>

                <div className="video-grid">
                  {videos.map((video) => (
                    <article key={video.id} className="video-card">
                      <div className="video-frame-shell">
                        <iframe
                          className="video-frame"
                          src={video.embedUrl}
                          title={video.title}
                          loading="lazy"
                          referrerPolicy="strict-origin-when-cross-origin"
                          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                          allowFullScreen
                        />
                      </div>

                      <div className="video-card-copy">
                        <p className="video-platform">{getPlatformLabel(video.platform)}</p>
                        <h3>{video.title}</h3>
                        {video.summary && <p className="video-summary">{video.summary}</p>}
                        <a
                          className="mini-btn video-link"
                          href={video.externalUrl}
                          target="_blank"
                          rel="noreferrer"
                        >
                          在 {getPlatformLabel(video.platform)} 上打开
                        </a>
                      </div>
                    </article>
                  ))}
                </div>
              </section>
            )}
          </div>
        </section>
      </main>

      <div className="mobile-cta">
        <a className="btn primary" href="#experience">查看 3D 船型</a>
      </div>
    </div>
  )
}