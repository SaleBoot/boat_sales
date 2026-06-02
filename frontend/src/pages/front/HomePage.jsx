import { useEffect, useMemo, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { getFrontBoatModels, getSiteContent } from '../../apis/frontApi';
import { usePointerGlow, useGlobalMenuClose } from '../../hooks/useUIEvents';
import { MODEL_STORAGE_KEY } from '../../constants/constants_front_homepage';
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
  getRequestedModelId,
} from '../../utils/utils_homepage';
import HomepageHeader from './homepage/HomepageHeader';
import HomePageHeroScreen from './homepage/HomePageHeroScreen';
import HomePageViewerScreen from './homepage/HomePageViewerScreen';
import DetailSpecShowcase from './homepage/DetailSpecShowcase';
import DetailCompareStack from './homepage/DetailCompareStack';
import VideoShowcase from './homepage/VideoShowcase';
import ShipScene from '../scene3d/ShipScene';

export default function HomePage() {
  // --- Logic migrated from App.jsx ---
  const runtimeBasePath = getRuntimeBasePath();
  const staticAssetBaseUrl = getStaticAssetBaseUrl(
    import.meta.env.VITE_STATIC_ASSET_ORIGIN,
    import.meta.env.BASE_URL
  );
  const remoteFbxOrigin = import.meta.env.VITE_REMOTE_FBX_ORIGIN || '';

  const captureMode = isCaptureModeEnabled();
  const resolveStaticPath = (relativePath) => `${staticAssetBaseUrl}${relativePath}`;

  const location = useLocation();
  const route = getRouteFromHash(location.hash);

  const [openCategoryId, setOpenCategoryId] = useState(null);
  const [openCompareSelectId, setOpenCompareSelectId] = useState(null);

  const [siteContent, setSiteContent] = useState(null);
  const [boatsMap, setBoatsMap] = useState({});
  const [modelsByCategory, setModelsByCategory] = useState([]);
  const [selectedBoatId, setSelectedBoatId] = useState(() => getRequestedModelId());

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [localSiteContent, apiBoats] = await Promise.all([
          getSiteContent(),
          getFrontBoatModels(),
        ]);

        if (localSiteContent) {
          setSiteContent(localSiteContent);
        }
        console.log('apiBoats:', apiBoats);
        if (apiBoats) {
          const { menu, boatMap } = apiBoats;

          // 1. Directly set the menu data for the header
          setModelsByCategory(menu || []);

          // 2. Set the boat map for quick O(1) lookups
          setBoatsMap(boatMap || {});

          // 3. Set the initial model based on the first item in the menu if not already set
          if (!getRequestedModelId()) {
            const firstCategory = menu?.[0];
            const firstModelId = firstCategory?.boats?.[0]?.id;
            if (firstModelId) {
              setSelectedBoatId(firstModelId);
            }
          }
        } else {
          console.warn('API did not return valid boat data or has incorrect structure.');
        }
      } catch (error) {
        console.error("获取首页数据失败:", error);
      }
    };

    fetchData();
  }, []);

  usePointerGlow();
  useGlobalMenuClose(setOpenCategoryId, setOpenCompareSelectId);

  const videos = siteContent?.videos ?? [];
  const siteSettings = normalizeSiteSettings(siteContent?.settings);
  const heroContent = normalizeHeroContent(siteContent?.hero);

  const primaryModel = useMemo(() => {
    const createStructuredModel = (boatData) => {
      if (!boatData) return null;

      const primaryModelInfo = boatData.models?.[0] || {};
      return {
        ...boatData, // boatData from API now includes id and label
        primaryModelInfo: primaryModelInfo, // Nest the specific model info
      };
    };

    if (!boatsMap) 
      return null;

    const selectBoat = boatsMap?.[selectedBoatId];
    if (selectBoat) {
      return createStructuredModel(selectBoat);
    }

    // Fallback to the first model 
    const firstModelKey = Object.keys(boatsMap)[0];
    if (firstModelKey) {
      return createStructuredModel(boatsMap[firstModelKey]);
    }
    return null; // 如果整个 map 确实是空的，安全返回 null
  }, [selectedBoatId, boatsMap]);

  // Diagnostic useEffect to track primaryModel changes
  useEffect(() => {
    console.log('[HomePage] primaryModel has been updated. New value:', primaryModel);
    if (primaryModel) {
      console.log(`[HomePage] -> primaryModel URL is: ${primaryModel.url}`);
    } else {
      console.log('[HomePage] -> The primaryModel is null.');
    }
  }, [primaryModel]);

  const brochurePath = resolveStaticPath(siteSettings.brochurePath);
  const heroImagePath = resolveStaticPath(siteSettings.heroImagePath);
  const maxCompareModelCount = siteSettings.compareLimit;
  
  const selectedModelLabel = getModelDisplayLabel(primaryModel) ||
    (Object.keys(boatsMap || {}).length ? '选择船型' : '正在加载船型');
  const selectedModelPriceLabel = getModelPriceLabel(primaryModel);
  const specImagePath = primaryModel
    ? resolveStaticPath(getModelDetailImageAssetPath(primaryModel))
    : '';
  const viewerSpecItems = buildViewerSpecItems(primaryModel);
  const primaryDetailSpecCards = buildComparisonSpecSections(primaryModel);
  const activeCategoryId = primaryModel?.category ?? modelsByCategory[0]?.id ?? null;

  const handleModelSelect = (modelId) => {
    console.log("[HomePage] handleModelSelect triggered with ID: ", modelId);
    if (!modelId || modelId === selectedBoatId) {
      console.log("[HomePage] Aborting: modelId is same as current or invalid.");
      return
    }

    setSelectedBoatId(modelId)
    window.localStorage.setItem(MODEL_STORAGE_KEY, modelId)
  };

  const scrollToExperience = () => {
    document
      .getElementById('experience')
      ?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  const handleCompareSelectToggle = (modelId) => {
    if (!modelId) {
      return;
    }

    setOpenCompareSelectId((current) => (current === modelId ? null : current));
  };

  // --- Original JSX from HomePage.jsx ---
  if (captureMode) {
    const pathSegment = primaryModel?.primaryModelInfo?.modelRuntimePath || '';
    const rawUrl = pathSegment.startsWith('http') ? pathSegment : `${remoteFbxOrigin}${pathSegment}`;
    const finalUrl = rawUrl.replace(/`/g, '').trim();

    return (
      <main className="capture-screen">
        <div className="capture-scene-shell">
          <ShipScene modelConfig={{ ...primaryModel, model: { path: finalUrl } }} />
        </div>
      </main>
    );
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
        selectedBoatId={selectedBoatId}
        brochurePath={brochurePath}
      />

      <main className="page-main" id="top">
        <HomePageHeroScreen
          heroImagePath={heroImagePath}
          heroContent={heroContent}
          scrollToExperience={scrollToExperience}
        />

        <HomePageViewerScreen
          selectedBoatId={selectedBoatId}
          primaryModel={primaryModel}
          runtimeBasePath={runtimeBasePath}
          remoteFbxOrigin={remoteFbxOrigin}
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
              models={Object.values(boatsMap)}
              selectedBoatId={selectedBoatId}
              maxCompareModelCount={maxCompareModelCount}
              openCompareSelectId={openCompareSelectId}
              setOpenCompareSelectId={setOpenCompareSelectId}
              handleModelSelect={handleModelSelect}
              resolveStaticPath={resolveStaticPath}
            />

            <VideoShowcase videos={videos} />
          </div>
        </section>
      </main>

      <div className="mobile-cta">
        <a className="btn primary" href="#experience">
          查看 3D 船型
        </a>
      </div>
    </div>
  );
}