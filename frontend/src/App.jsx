import { Suspense, useEffect, useMemo, useState } from 'react'
import { Outlet, useLocation } from 'react-router-dom'
import { AuthProvider } from './pages/admin/context/AuthContext'
import AdminPage from './pages/admin/AdminPage-notused'
import OrderPage from './pages/front/OrderPage'
import OrderSuccessPage from './pages/front/OrderSuccessPage'
import HomePage from './pages/front/HomePage'
import { useShowcaseData } from './hooks/useShowcaseData'
import { usePointerGlow, useGlobalMenuClose } from './hooks/useUIEvents'
import {
  MODEL_STORAGE_KEY,
  vesselCategoryMenus,
} from './constants/constants_front_homepage'

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
  normalizeCompareModelIds,
} from './utils/utils_homepage'

function MainApp() {
  const runtimeBasePath = getRuntimeBasePath()
  const staticAssetBaseUrl = getStaticAssetBaseUrl(
    import.meta.env.VITE_STATIC_ASSET_ORIGIN,
    import.meta.env.BASE_URL
  )

  const captureMode = isCaptureModeEnabled()
  const resolveStaticPath = (relativePath) => `${staticAssetBaseUrl}${relativePath}`
  
  const location = useLocation();
  const route = getRouteFromHash(location.hash)

  const [openCategoryId, setOpenCategoryId] = useState(null)
  const [openCompareSelectId, setOpenCompareSelectId] = useState(null)
  
  const { modelManifest, siteContent, selectedModelId, setSelectedModelId } =
    useShowcaseData(route, runtimeBasePath, staticAssetBaseUrl)

  usePointerGlow()

  useGlobalMenuClose(setOpenCategoryId, setOpenCompareSelectId)
  
  const modelContentById = siteContent?.models ?? {}
  const models = useMemo(
    () =>
      (modelManifest?.models ?? [])
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
            renderConfig: content.renderConfig ?? {},
          }
        }),
    [modelManifest, modelContentById]
  )

  const videos = siteContent?.videos ?? []
  const siteSettings = normalizeSiteSettings(siteContent?.settings)
  const heroContent = normalizeHeroContent(siteContent?.hero)

  const primaryModel =
    models.find((model) => model.id === selectedModelId) ?? null
  const selectedModelLabel =
    getModelDisplayLabel(primaryModel) ||
    (models.length ? '选择船型' : '正在加载船型')
  const selectedModelPriceLabel = getModelPriceLabel(primaryModel)
  const brochurePath = resolveStaticPath(siteSettings.brochurePath)
  const heroImagePath = resolveStaticPath(siteSettings.heroImagePath)
  const specImagePath = primaryModel
    ? resolveStaticPath(getModelDetailImageAssetPath(primaryModel))
    : ''
  const viewerSpecItems = buildViewerSpecItems(primaryModel)
  const primaryDetailSpecCards = buildComparisonSpecSections(primaryModel)

  const modelsByCategory = useMemo(
    () =>
      vesselCategoryMenus
        .map((category) => ({
          ...category,
          models: models.filter(
            (model) => getCategoryIdForModel(model) === category.id
          ),
        }))
        .filter((category) => category.models.length > 0),
    [models]
  )

  const maxCompareModelCount = siteSettings.compareLimit
  const activeCategoryId =
    primaryModel
      ? getCategoryIdForModel(primaryModel)
      : modelsByCategory[0]?.id ?? null

  const handleModelSelect = (modelId) => {
    if (!modelId || modelId === selectedModelId) {
      return
    }

    setSelectedModelId(modelId)
    window.localStorage.setItem(MODEL_STORAGE_KEY, modelId)
  }

  const scrollToExperience = () => {
    document
      .getElementById('experience')
      ?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }

  const handleCompareSelectToggle = (modelId) => {
    if (!modelId) {
      return
    }

    setOpenCompareSelectId((current) => (current === modelId ? null : modelId))
  }

  const pageProps = {
    captureMode,
    modelsByCategory,
    activeCategoryId,
    openCategoryId,
    setOpenCategoryId,
    handleModelSelect,
    scrollToExperience,
    selectedModelId,
    brochurePath,
    heroImagePath,
    heroContent,
    primaryModel,
    runtimeBasePath,
    selectedModelLabel,
    selectedModelPriceLabel,
    viewerSpecItems,
    specImagePath,
    primaryDetailSpecCards,
    models,
    maxCompareModelCount,
    openCompareSelectId,
    setOpenCompareSelectId,
    handleCompareSelectToggle,
    resolveStaticPath,
    videos,
    onSelectModel: handleModelSelect,
    apiBasePath: runtimeBasePath,
  }

  return <Outlet context={pageProps} />;
}

// -------------------------------------------------------
export default function App() {
  const location = useLocation();
  const isAdminRoute = location.pathname.startsWith('/admin') || location.pathname === '/login';

  return (
    <AuthProvider>
      <Suspense fallback={<div>Loading...</div>}>
        {isAdminRoute ? <Outlet /> : <MainApp />}
      </Suspense>
    </AuthProvider>
  )
}