import { useEffect, useMemo, useRef, useState } from 'react'
import { useOutletContext } from 'react-router-dom';
import ShipScene from '../scene3d/ShipScene'

const productCategories = ['新能源船', '应急救援船', '公务执法艇', '游艇']

const configurationSteps = ['船型', '外观', '内饰', '动力', '选装']

const sectionIds = {
  船型: 'order-section-model',
  外观: 'order-section-appearance',
  内饰: 'order-section-interior',
  动力: 'order-section-power',
  选装: 'order-section-options'
}

const orderStageOptions = [
  { id: 'model', label: '1 确认船型' },
  { id: 'config', label: '2 定制方案' },
  { id: 'submit', label: '3 留资跟进' }
]

const stepFocusTargets = {
  船型: 'exterior',
  外观: 'exterior',
  内饰: 'interior',
  动力: 'engine',
  选装: 'console'
}

const COMPACT_STEP_WHEEL_LOCK_MS = 520
const COMPACT_STEP_HEIGHT_RATIO = 0.82
const MIN_WHEEL_DELTA = 8
const CONFIG_STEP_SCROLL_OFFSET = 112

const DEFAULT_ORDER_CONFIG = {
  appearanceOptions: [
    {
      id: 'business',
      label: '商务接待外观',
      description: '以干净比例和稳重识别为主，适合展示、接待与日常运营',
      price: 0
    },
    {
      id: 'sport',
      label: '动感识别外观',
      description: '强化速度感与视觉记忆点，适合品牌展示和高曝光场景',
      price: 12000
    },
    {
      id: 'duty',
      label: '公务执法外观',
      description: '突出任务属性和远距离识别度，适合巡航、执法与应急联动',
      price: 18000
    }
  ],
  colorOptions: [],
  interiorOptions: [
    {
      id: 'marine-gray',
      label: '海舱灰功能内饰',
      description: '克制、耐看、易维护，适合商务接待与现代化工作船',
      price: 0
    },
    {
      id: 'warm-teak',
      label: '暖木游艇内饰',
      description: '突出木饰面、软包与温暖氛围，适合游艇休闲和高端接待',
      price: 26000
    },
    {
      id: 'task-black',
      label: '任务黑耐用内饰',
      description: '强调耐磨、抗污和设备集成，适合执法、救援与高强度任务',
      price: 18000
    }
  ],
  powerOptions: [
    {
      id: 'dual-electric-standard',
      label: '高效巡航动力',
      description: '兼顾静音巡航、日常接待与中短途运营，适合作为标准交付方案',
      price: 368000
    },
    {
      id: 'dual-electric-performance',
      label: '高性能任务动力',
      description: '提升加速响应与连续航行稳定性，适合高频使用与更复杂水域',
      price: 428000
    },
    {
      id: 'hybrid-rescue',
      label: '混动应急动力',
      description: '面向救援、巡逻与长时间值守任务，兼顾续航和负载能力',
      price: 468000
    }
  ],
  optionalSeriesOptions: [],
  focusTargets: {}
}

function formatPrice(value) {
  return new Intl.NumberFormat('zh-CN', {
    style: 'currency',
    currency: 'CNY',
    maximumFractionDigits: 0
  }).format(value)
}

function getModelReferencePrice(model) {
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

function getModelReferencePriceLabel(model) {
  const amount = getModelReferencePrice(model)
  if (amount === null) {
    return ''
  }

  return `参考价 ${formatPrice(amount)}`
}

function normalizeBasePath(basePath) {
  const normalizedValue = `${basePath ?? ''}`.trim()
  if (!normalizedValue) {
    return '/'
  }

  return normalizedValue.endsWith('/') ? normalizedValue : `${normalizedValue}/`
}

function buildApiUrl(basePath, path) {
  const normalizedBasePath = normalizeBasePath(basePath)
  const normalizedPath = `${path ?? ''}`.replace(/^\/+/, '')
  return `${normalizedBasePath}${normalizedPath}`
}

function getCategoryForModel(model) {
  const explicitType = `${model?.type ?? ''}`.trim()
  if (explicitType) {
    return explicitType
  }

  const label = `${model?.label ?? model?.id ?? ''}`.toLowerCase()
  if (label.includes('yacht') || label.includes('游艇')) {
    return '游艇'
  }
  if (label.includes('two')) {
    return '公务执法艇'
  }
  if (label.includes('test') || label.includes('pleasure')) {
    return '新能源船'
  }
  return '应急救援船'
}

function getModelCaption(model) {
  const specs = model?.specs ?? {}
  if (specs.mainEnginePower) {
    return `主机功率 ${specs.mainEnginePower}`
  }
  if (specs.designSpeed) {
    return `设计航速 ≥ ${specs.designSpeed} km/h`
  }
  if (specs.navigationArea) {
    return specs.navigationArea
  }
  return model?.id ?? ''
}

function normalizeOrderConfig(orderConfig) {
  const config = orderConfig ?? {}
  return {
    appearanceOptions: Array.isArray(config.appearanceOptions) ? config.appearanceOptions : [],
    colorOptions: Array.isArray(config.colorOptions) ? config.colorOptions : [],
    interiorOptions: Array.isArray(config.interiorOptions) ? config.interiorOptions : [],
    powerOptions: Array.isArray(config.powerOptions) ? config.powerOptions : [],
    optionalSeriesOptions: Array.isArray(config.optionalSeriesOptions) ? config.optionalSeriesOptions : [],
    focusTargets: config.focusTargets && Object.keys(config.focusTargets).length ? config.focusTargets : {}
  }
}

function getFocusTargetForOptionalSelection(options, selectedIds) {
  for (const option of options) {
    if (selectedIds.includes(option.id) && option.focusTarget) {
      return option.focusTarget
    }
  }
  return ''
}

function getMaterialOverridesForOptionalSelection(options, selectedIds) {
  return options
    .filter((option) => selectedIds.includes(option.id))
    .flatMap((option) => Array.isArray(option.materialOverrides) ? option.materialOverrides : [])
}

export default function OrderPage() {
  const {
    models,
    primaryModel,
    selectedModelId,
    onSelectModel,
    apiBasePath = '/'
  } = useOutletContext();

  const currentModel = primaryModel
    ?? models.find((model) => model.id === selectedModelId)
    ?? models[0]
    ?? null

  const currentOrderConfig = useMemo(() => normalizeOrderConfig(currentModel?.orderConfig), [currentModel])
  const [loadedFocusTargets, setLoadedFocusTargets] = useState(currentOrderConfig.focusTargets)

  const [selectedCategory, setSelectedCategory] = useState(getCategoryForModel(currentModel))
  const [selectedAppearanceId, setSelectedAppearanceId] = useState(currentOrderConfig.appearanceOptions[0]?.id ?? '')
  const [selectedColorId, setSelectedColorId] = useState(currentOrderConfig.colorOptions[0]?.id ?? '')
  const [selectedInteriorId, setSelectedInteriorId] = useState(currentOrderConfig.interiorOptions[0]?.id ?? '')
  const [selectedPowerId, setSelectedPowerId] = useState(currentOrderConfig.powerOptions[0]?.id ?? '')
  const [selectedOptionalIds, setSelectedOptionalIds] = useState([
    currentOrderConfig.optionalSeriesOptions[0]?.id,
    currentOrderConfig.optionalSeriesOptions[2]?.id
  ].filter(Boolean))
  const [activeConfigStep, setActiveConfigStep] = useState('船型')
  const [activeOrderStage, setActiveOrderStage] = useState('config')
  const [isSubmittingOrder, setIsSubmittingOrder] = useState(false)
  const [submitError, setSubmitError] = useState('')
  const [customerName, setCustomerName] = useState('')
  const [customerContact, setCustomerContact] = useState('')
  const compactStepWheelLockRef = useRef({
    step: '',
    direction: 0,
    unlockAt: 0
  })
  const programmaticStepScrollRef = useRef({
    step: '',
    releaseAt: 0,
    timerId: null
  })

  useEffect(() => {
    setSelectedCategory(getCategoryForModel(currentModel))
  }, [currentModel])

  useEffect(() => {
    const nextConfig = normalizeOrderConfig(currentModel?.orderConfig)
    setSelectedAppearanceId((current) => nextConfig.appearanceOptions.some((item) => item.id === current) ? current : (nextConfig.appearanceOptions[0]?.id ?? ''))
    setSelectedColorId((current) => nextConfig.colorOptions.some((item) => item.id === current) ? current : (nextConfig.colorOptions[0]?.id ?? ''))
    setSelectedInteriorId((current) => nextConfig.interiorOptions.some((item) => item.id === current) ? current : (nextConfig.interiorOptions[0]?.id ?? ''))
    setSelectedPowerId((current) => nextConfig.powerOptions.some((item) => item.id === current) ? current : (nextConfig.powerOptions[0]?.id ?? ''))
    setSelectedOptionalIds((current) => current.filter((id) => nextConfig.optionalSeriesOptions.some((item) => item.id === id)))
  }, [currentModel])

  const filteredModels = useMemo(
    () => models.filter((model) => getCategoryForModel(model) === selectedCategory),
    [models, selectedCategory]
  )

  const activeModel = currentModel ?? filteredModels[0] ?? models[0] ?? null
  const activeOrderConfig = useMemo(() => normalizeOrderConfig(activeModel?.orderConfig), [activeModel])
  const effectiveFocusTargets = loadedFocusTargets && Object.keys(loadedFocusTargets).length
    ? loadedFocusTargets
    : activeOrderConfig.focusTargets

  useEffect(() => {
    setLoadedFocusTargets(activeOrderConfig.focusTargets)
  }, [activeOrderConfig.focusTargets, currentModel?.id])

  useEffect(() => {
    if (!currentModel?.id) {
      setLoadedFocusTargets({})
      return
    }

    let cancelled = false

    const loadFocusTargets = async () => {
      try {
        const response = await fetch(buildApiUrl(apiBasePath, `api/models/${encodeURIComponent(currentModel.id)}/focus-targets`))
        if (!response.ok) {
          throw new Error(`Failed to load focus targets: ${response.status}`)
        }

        const payload = await response.json()
        if (!cancelled) {
          setLoadedFocusTargets(payload?.focusTargets ?? {})
        }
      } catch (error) {
        console.error(`Failed to load focus targets for ${currentModel.id}:`, error)
        if (!cancelled) {
          setLoadedFocusTargets(activeOrderConfig.focusTargets)
        }
      }
    }

    loadFocusTargets()

    return () => {
      cancelled = true
    }
  }, [activeOrderConfig.focusTargets, apiBasePath, currentModel?.id])
  const activeAppearance = activeOrderConfig.appearanceOptions.find((item) => item.id === selectedAppearanceId) ?? activeOrderConfig.appearanceOptions[0]
  const activeColor = activeOrderConfig.colorOptions.find((item) => item.id === selectedColorId) ?? activeOrderConfig.colorOptions[0]
  const activeInterior = activeOrderConfig.interiorOptions.find((item) => item.id === selectedInteriorId) ?? activeOrderConfig.interiorOptions[0]
  const activePower = activeOrderConfig.powerOptions.find((item) => item.id === selectedPowerId) ?? activeOrderConfig.powerOptions[0]
  const activeModelReferencePrice = getModelReferencePrice(activeModel)
  const activeModelReferencePriceLabel = getModelReferencePriceLabel(activeModel)
  const availableOptionalSeries = activeOrderConfig.optionalSeriesOptions.filter((item) => !item.yachtOnly || activeModel?.type === '游艇')
  const activeOptionalSeries = availableOptionalSeries.filter((item) => selectedOptionalIds.includes(item.id))

  const activeOptionalFocusTarget = getFocusTargetForOptionalSelection(activeOrderConfig.optionalSeriesOptions, selectedOptionalIds)
  const activeOptionalMaterialOverrides = useMemo(
    () => getMaterialOverridesForOptionalSelection(activeOrderConfig.optionalSeriesOptions, selectedOptionalIds),
    [activeOrderConfig.optionalSeriesOptions, selectedOptionalIds]
  )
  const sceneFocusTarget = activeConfigStep === '选装' && activeOptionalFocusTarget
    ? activeOptionalFocusTarget
    : stepFocusTargets[activeConfigStep] ?? 'exterior'

  const totalPrice = (activeModelReferencePrice ?? 0)
    + (activeAppearance?.price ?? 0)
    + (activeColor?.surcharge ?? 0)
    + (activeInterior?.price ?? 0)
    + (activePower?.price ?? 0)
    + activeOptionalSeries.reduce((sum, item) => sum + (item.price ?? 0), 0)

  useEffect(() => {
    const updateActiveStage = () => {
      const modelSection = document.getElementById('order-section-model')
      const submitSection = document.getElementById('order-section-submit')
      if (!modelSection) {
        return
      }

      const probeLine = 140
      const modelRect = modelSection.getBoundingClientRect()
      const submitRect = submitSection?.getBoundingClientRect()

      if (submitRect && submitRect.top <= probeLine + 40) {
        setActiveOrderStage('submit')
        return
      }

      if (modelRect.bottom > probeLine) {
        setActiveOrderStage('model')
        return
      }

      setActiveOrderStage('config')
    }

    updateActiveStage()
    window.addEventListener('scroll', updateActiveStage, { passive: true })
    window.addEventListener('resize', updateActiveStage)

    return () => {
      window.removeEventListener('scroll', updateActiveStage)
      window.removeEventListener('resize', updateActiveStage)
    }
  }, [])

  useEffect(() => {
    const stepEntries = Object.entries(sectionIds)

    const updateActiveConfigStep = () => {
      const programmaticScroll = programmaticStepScrollRef.current
      if (programmaticScroll.step && performance.now() < programmaticScroll.releaseAt) {
        setActiveConfigStep((previous) => (
          previous === programmaticScroll.step ? previous : programmaticScroll.step
        ))
        return
      }

      const viewportProbe = 180
      let currentStep = configurationSteps[0]
      let bestDistance = Number.POSITIVE_INFINITY

      stepEntries.forEach(([step, sectionId]) => {
        const element = document.getElementById(sectionId)
        if (!element) {
          return
        }

        const rect = element.getBoundingClientRect()
        const distance = Math.abs(rect.top - viewportProbe)

        if (rect.top <= viewportProbe && rect.bottom >= viewportProbe) {
          currentStep = step
          bestDistance = -1
          return
        }

        if (bestDistance !== -1 && distance < bestDistance) {
          currentStep = step
          bestDistance = distance
        }
      })

      setActiveConfigStep((previous) => (previous === currentStep ? previous : currentStep))
    }

    updateActiveConfigStep()
    window.addEventListener('scroll', updateActiveConfigStep, { passive: true })
    window.addEventListener('resize', updateActiveConfigStep)

    return () => {
      window.removeEventListener('scroll', updateActiveConfigStep)
      window.removeEventListener('resize', updateActiveConfigStep)
      if (programmaticStepScrollRef.current.timerId) {
        window.clearTimeout(programmaticStepScrollRef.current.timerId)
      }
    }
  }, [])

  useEffect(() => {
    const getStepIndex = (step) => configurationSteps.indexOf(step)
    const isCompactSection = (element) => (
      element.scrollHeight <= Math.max(window.innerHeight * COMPACT_STEP_HEIGHT_RATIO, 420)
    )

    const handleWheelGate = (event) => {
      if (event.defaultPrevented || Math.abs(event.deltaY) < MIN_WHEEL_DELTA) {
        return
      }

      const direction = Math.sign(event.deltaY)
      const currentIndex = getStepIndex(activeConfigStep)
      if (currentIndex < 0) {
        return
      }

      const nextStep = configurationSteps[currentIndex + direction]
      if (!nextStep) {
        return
      }

      const currentSection = document.getElementById(sectionIds[activeConfigStep])
      const nextSection = document.getElementById(sectionIds[nextStep])
      const configColumn = document.querySelector('.order-config-column')
      if (!currentSection || !nextSection || !configColumn || !isCompactSection(currentSection)) {
        return
      }

      const columnRect = configColumn.getBoundingClientRect()
      const currentRect = currentSection.getBoundingClientRect()
      const viewportProbe = 180
      const isInsideConfigColumn = columnRect.top < window.innerHeight && columnRect.bottom > viewportProbe
      const isNearCurrentStep = currentRect.top <= viewportProbe + 48 && currentRect.bottom >= viewportProbe - 48
      if (!isInsideConfigColumn || !isNearCurrentStep) {
        return
      }

      const now = performance.now()
      const lock = compactStepWheelLockRef.current
      if (lock.direction === direction && now < lock.unlockAt) {
        event.preventDefault()
        return
      }

      event.preventDefault()
      compactStepWheelLockRef.current = {
        step: nextStep,
        direction,
        unlockAt: now + COMPACT_STEP_WHEEL_LOCK_MS
      }
      if (programmaticStepScrollRef.current.timerId) {
        window.clearTimeout(programmaticStepScrollRef.current.timerId)
      }
      programmaticStepScrollRef.current = {
        step: nextStep,
        releaseAt: now + COMPACT_STEP_WHEEL_LOCK_MS + 260,
        timerId: window.setTimeout(() => {
          programmaticStepScrollRef.current = {
            step: '',
            releaseAt: 0,
            timerId: null
          }
        }, COMPACT_STEP_WHEEL_LOCK_MS + 280)
      }
      setActiveConfigStep(nextStep)
      window.scrollTo({
        top: Math.max(nextSection.getBoundingClientRect().top + window.scrollY - CONFIG_STEP_SCROLL_OFFSET, 0),
        behavior: 'smooth'
      })
    }

    window.addEventListener('wheel', handleWheelGate, { passive: false })

    return () => {
      window.removeEventListener('wheel', handleWheelGate)
    }
  }, [activeConfigStep])

  const handleCategorySelect = (category) => {
    setSelectedCategory(category)
    const nextModel = models.find((model) => getCategoryForModel(model) === category)
    if (nextModel) {
      onSelectModel(nextModel.id)
    }
  }

  const handleOptionalToggle = (optionId) => {
    setSelectedOptionalIds((current) => (
      current.includes(optionId)
        ? current.filter((id) => id !== optionId)
        : [...current, optionId]
    ))
  }

  const handleStepJump = (step) => {
    setActiveConfigStep(step)
    const targetId = sectionIds[step]
    if (!targetId) {
      return
    }

    document.getElementById(targetId)?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }

  const handleOrderStageSelect = (nextStage) => {
    setActiveOrderStage(nextStage)

    if (nextStage === 'model') {
      handleStepJump('船型')
      return
    }

    if (nextStage === 'config') {
      document.querySelector('.order-config-nav')?.scrollIntoView({ behavior: 'smooth', block: 'start' })
      return
    }

    document.getElementById('order-section-submit')?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }

  const handleSubmitOrder = async () => {
    if (!activeModel) {
      setSubmitError('当前没有可提交的船型，请先选择船型。')
      return
    }

    const normalizedCustomerName = customerName.trim()
    const normalizedCustomerContact = customerContact.trim()
    if (!normalizedCustomerName) {
      setSubmitError('请填写称呼方式。')
      return
    }
    if (!normalizedCustomerContact) {
      setSubmitError('请填写联系方式。')
      return
    }

    setIsSubmittingOrder(true)
    setSubmitError('')

    try {
      const response = await fetch(buildApiUrl(apiBasePath, '/api/orders'), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          modelId: activeModel.id,
          modelLabel: activeModel.label,
          customerName: normalizedCustomerName,
          customerContact: normalizedCustomerContact,
          category: activeModel.type || getCategoryForModel(activeModel),
          appearanceLabel: activeAppearance?.label ?? '',
          colorLabel: activeColor?.label ?? '',
          colorHex: activeColor?.hex ?? '',
          interiorLabel: activeInterior?.label ?? '',
          powerLabel: activePower?.label ?? '',
          optionalPackageLabels: activeOptionalSeries.map((item) => item.label),
          totalPrice,
          source: 'showcase-web'
        })
      })
      const payload = await response.json().catch(() => null)

      if (!response.ok) {
        throw new Error(payload?.error ?? `提交失败，状态码 ${response.status}`)
      }

      const orderId = `${payload?.order?.id ?? ''}`.trim()
      window.location.hash = orderId
        ? `#/order-success?order=${encodeURIComponent(orderId)}`
        : '#/order-success'
    } catch (error) {
      setSubmitError(error.message || '提交方案意向失败，请稍后再试。')
    } finally {
      setIsSubmittingOrder(false)
    }
  }

  return (
    <div className="order-page">
      <header className="order-topbar">
        <div className="order-topbar-inner">
          <a className="order-back-link" href="#top">返回首页</a>
          <div className="order-progress" aria-label="订购流程">
            {orderStageOptions.map((option) => (
              <button
                key={option.id}
                type="button"
                className={`order-progress-step ${activeOrderStage === option.id ? 'active' : ''}`}
                onClick={() => handleOrderStageSelect(option.id)}
              >
                {option.label}
              </button>
            ))}
          </div>
        </div>
      </header>

      <main className="order-shell">
        <section className="order-visual-column">
          <div className="order-visual-sticky">
            <div className="order-scene-panel">
              {activeModel ? (
                <ShipScene
                  modelConfig={activeModel}
                  focusTarget={sceneFocusTarget}
                  focusTargetPresets={effectiveFocusTargets}
                  colorConfig={activeColor}
                  optionalMaterialOverrides={activeOptionalMaterialOverrides}
                  overviewZoomScale={0.82}
                />
              ) : <div className="order-scene-empty">暂无可预览模型</div>}
            </div>
          </div>
        </section>

        <section className="order-config-column">
          <div className="order-config-nav" aria-label="配置导航">
            {configurationSteps.map((item) => (
              <button
                key={item}
                type="button"
                className={`order-config-nav-item ${activeConfigStep === item ? 'active' : ''}`}
                onClick={() => handleStepJump(item)}
              >
                {item}
              </button>
            ))}
          </div>

          <section id="order-section-model" className="order-config-section">
            <div className="order-section-header">
              <p className="order-section-step">01</p>
              <div>
                <h2>船型</h2>
                <p>先确认适用场景，再选择对应船型。不同船型会带出不同的配置词条。</p>
              </div>
            </div>

            <div className="order-category-row" role="tablist" aria-label="船型分类">
              {productCategories.map((category) => (
                <button
                  key={category}
                  type="button"
                  className={`order-category-chip ${selectedCategory === category ? 'active' : ''}`}
                  onClick={() => handleCategorySelect(category)}
                >
                  {category}
                </button>
              ))}
            </div>

            <div className="order-model-grid">
              {filteredModels.map((model) => {
                const isActive = model.id === activeModel?.id

                return (
                  <button
                    key={model.id}
                    type="button"
                    className={`order-model-card ${isActive ? 'active' : ''}`}
                    onClick={() => onSelectModel(model.id)}
                  >
                    <div className="order-model-card-copy">
                      <p className="order-model-category">{getCategoryForModel(model)}</p>
                      <h3>{model.label}</h3>
                      <p>{getModelCaption(model)}</p>
                      {getModelReferencePriceLabel(model) && (
                        <p className="order-model-card-price">{getModelReferencePriceLabel(model)}</p>
                      )}
                    </div>
                    <span className="order-model-card-state">{isActive ? '已选中' : '选择'}</span>
                  </button>
                )
              })}
            </div>
          </section>

          <section id="order-section-appearance" className="order-config-section">
            <div className="order-section-header">
              <p className="order-section-step">02</p>
              <div>
                <h2>外观</h2>
                <p>选择识别风格与船体颜色，形成初步交付视觉方向。</p>
              </div>
            </div>

            <div className="order-option-stack">
              {activeOrderConfig.appearanceOptions.map((option) => (
                <label key={option.id} className={`order-radio-card ${selectedAppearanceId === option.id ? 'active' : ''}`}>
                  <input
                    type="radio"
                    name="appearanceOption"
                    checked={selectedAppearanceId === option.id}
                    onChange={() => setSelectedAppearanceId(option.id)}
                  />
                  <div>
                    <h3>{option.label}</h3>
                    <p>{option.description}</p>
                  </div>
                  <strong>{option.price > 0 ? formatPrice(option.price) : '标准'}</strong>
                </label>
              ))}
            </div>

            {activeOrderConfig.colorOptions.length > 0 ? (
              <div className="order-color-grid order-subsection">
                {activeOrderConfig.colorOptions.map((color) => {
                  const isActive = color.id === selectedColorId

                  return (
                    <button
                      key={color.id}
                      type="button"
                      className={`order-color-card ${isActive ? 'active' : ''}`}
                      onClick={() => setSelectedColorId(color.id)}
                    >
                      <span className="order-color-swatch" style={{ backgroundColor: color.hex }} />
                      <div>
                        <h3>{color.label}</h3>
                        <p>{color.surcharge > 0 ? `${formatPrice(color.surcharge)} 选装` : '标准配色'}</p>
                      </div>
                    </button>
                  )
                })}
              </div>
            ) : (
              <p className="order-empty-note">当前船型暂未配置可选船体颜色。</p>
            )}
          </section>

          <section id="order-section-interior" className="order-config-section">
            <div className="order-section-header">
              <p className="order-section-step">03</p>
              <div>
                <h2>内饰</h2>
                <p>根据接待、巡逻、救援或休闲场景，选择更合适的舱内材质与氛围。</p>
              </div>
            </div>

            <div className="order-option-stack">
              {activeOrderConfig.interiorOptions.map((option) => (
                <label key={option.id} className={`order-radio-card ${selectedInteriorId === option.id ? 'active' : ''}`}>
                  <input
                    type="radio"
                    name="interiorOption"
                    checked={selectedInteriorId === option.id}
                    onChange={() => setSelectedInteriorId(option.id)}
                  />
                  <div>
                    <h3>{option.label}</h3>
                    <p>{option.description}</p>
                  </div>
                  <strong>{option.price > 0 ? formatPrice(option.price) : '标准'}</strong>
                </label>
              ))}
            </div>
          </section>

          <section id="order-section-power" className="order-config-section">
            <div className="order-section-header">
              <p className="order-section-step">04</p>
              <div>
                <h2>动力</h2>
                <p>按航区、载荷与任务强度选择动力方案。</p>
              </div>
            </div>

            <div className="order-option-stack">
              {activeOrderConfig.powerOptions.map((option) => (
                <label key={option.id} className={`order-radio-card ${selectedPowerId === option.id ? 'active' : ''}`}>
                  <input
                    type="radio"
                    name="powerOption"
                    checked={selectedPowerId === option.id}
                    onChange={() => setSelectedPowerId(option.id)}
                  />
                  <div>
                    <h3>{option.label}</h3>
                    <p>{option.description}</p>
                  </div>
                  <strong>{formatPrice(option.price)}</strong>
                </label>
              ))}
            </div>
          </section>

          <section id="order-section-options" className="order-config-section">
            <div className="order-section-header">
              <p className="order-section-step">05</p>
              <div>
                <h2>选装</h2>
                <p>可叠加智能监控、执法辅助、维护系统与游艇娱乐系统。</p>
              </div>
            </div>

            {availableOptionalSeries.length > 0 ? (
              <div className="order-option-stack">
                {availableOptionalSeries.map((option) => {
                  const isActive = selectedOptionalIds.includes(option.id)
                  return (
                    <label
                      key={option.id}
                      className={`order-check-card ${isActive ? 'active' : ''}`}
                    >
                      <input
                        type="checkbox"
                        checked={isActive}
                        onChange={() => handleOptionalToggle(option.id)}
                      />
                      <div>
                        <h3>{option.label}</h3>
                        <p>{option.description}</p>
                      </div>
                      <strong>{formatPrice(option.price)}</strong>
                    </label>
                  )
                })}
              </div>
            ) : (
              <p className="order-empty-note">当前船型暂未配置选装项目。</p>
            )}
          </section>

          <section id="order-section-submit" className="order-summary-card">
            <p className="order-kicker">配置摘要</p>
            <h2>{activeModel?.label ?? '未选择船型'}</h2>

            <div className="order-summary-list">
              <div>
                <span>船型</span>
                <strong>{activeModel?.label ?? '-'}</strong>
              </div>
              {activeModelReferencePriceLabel && (
                <div>
                  <span>船型参考价</span>
                  <strong>{formatPrice(activeModelReferencePrice)}</strong>
                </div>
              )}
              <div>
                <span>外观</span>
                <strong>{activeAppearance?.label ?? '-'}</strong>
              </div>
              <div>
                <span>内饰</span>
                <strong>{activeInterior?.label ?? '-'}</strong>
              </div>
              <div>
                <span>动力</span>
                <strong>{activePower?.label ?? '-'}</strong>
              </div>
              <div>
                <span>船体颜色</span>
                <strong>{activeColor?.label ?? '-'}</strong>
              </div>
            </div>

            <div className="order-summary-packages">
              <p>已选选装</p>
              {activeOptionalSeries.length > 0 ? (
                activeOptionalSeries.map((item) => (
                  <div key={item.id} className="order-summary-package-item">
                    <span>{item.label}</span>
                    <strong>{formatPrice(item.price)}</strong>
                  </div>
                ))
              ) : (
                <span className="order-summary-empty">暂未选择选装项目</span>
              )}
            </div>

            <div className="order-total">
              <span>参考总价</span>
              <strong>{formatPrice(totalPrice)}</strong>
            </div>

            <div className="order-contact-form" aria-label="联系方式">
              <div className="order-contact-header">
                <p>方案跟进信息</p>
                <span>销售顾问将基于当前配置与您确认技术细节、报价范围与交付节奏。</span>
              </div>
              <label className="order-contact-field">
                <span>称呼方式</span>
                <input
                  type="text"
                  value={customerName}
                  onChange={(event) => setCustomerName(event.target.value)}
                  placeholder="例如：王先生 / 李女士"
                  autoComplete="name"
                />
              </label>
              <label className="order-contact-field">
                <span>联系方式</span>
                <input
                  type="text"
                  value={customerContact}
                  onChange={(event) => setCustomerContact(event.target.value)}
                  placeholder="手机号 / 微信 / 邮箱，任选一种即可"
                  autoComplete="tel"
                />
              </label>
            </div>

            {submitError && (
              <p className="order-submit-error">{submitError}</p>
            )}

            <div className="order-actions">
              <button
                type="button"
                className="btn primary"
                onClick={handleSubmitOrder}
                disabled={isSubmittingOrder}
              >
                {isSubmittingOrder ? '提交中...' : '提交订购意向'}
              </button>

              <a className="mini-btn order-secondary-btn" href="#experience">返回 3D 体验</a>
            </div>
          </section>
        </section>
      </main>
    </div>
  )
}