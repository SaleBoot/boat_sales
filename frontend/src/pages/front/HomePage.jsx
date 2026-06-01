import { useEffect, useMemo, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { getFrontBoatModels } from '../../apis/frontApi';
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
  const [allBoats, setAllBoats] = useState([]);
  const [modelsByCategory, setModelsByCategory] = useState([]);
  const [selectedModelId, setSelectedModelId] = useState(() => getRequestedModelId());

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [siteContentRes, apiBoats] = await Promise.all([
          fetch('/app-json/site-content.json'),
          getFrontBoatModels(),
        ]);

        console.log('Raw data from getFrontBoatModels:', apiBoats);

        if (!siteContentRes.ok) {
          throw new Error('Failed to fetch local site-content.json.');
        }

        const localSiteContent = await siteContentRes.json();
        setSiteContent(localSiteContent);

        if (apiBoats && typeof apiBoats.categories === 'object' && typeof apiBoats.boats === 'object') {
          const { categories, boats } = apiBoats;

          // Process the nested boat data into a flat structure for the rest of the app.
          const processedBoats = Object.values(boats).flat().map(boat => {
            // The primary model info (especially modelRuntimePath) is in the nested models array.
            const primaryModelInfo = boat.models && boat.models[0] ? boat.models[0] : {};
            return {
              ...boat,
              ...primaryModelInfo,
              id: boat.boatEnName, // Ensure the main ID is from the parent boat.
            };
          }).filter(boat => boat.modelRuntimePath); // Ensure we only keep boats with a valid model path.

          setAllBoats(processedBoats);

          // The menu data generation remains correct.
          const menuData = Object.keys(categories).map(categoryKey => ({
            id: categoryKey,
            label: categories[categoryKey],
            models: (boats[categoryKey] || []).map(boat => ({
              id: boat.boatEnName,
              label: boat.boatName,
            })),
          }));
          setModelsByCategory(menuData);

        } else {
          console.warn('API did not return valid boat data or has incorrect structure.');
        }

      } catch (err) {
        console.error('Failed to fetch initial data:', err);
      }
    };

    fetchData();
  }, []);

  usePointerGlow();
  useGlobalMenuClose(setOpenCategoryId, setOpenCompareSelectId);

  const models = useMemo(() => {
    if (!allBoats || allBoats.length === 0) return [];
    return allBoats.filter(isVesselModel).map((boat) => {
      const pathSegment = boat.modelRuntimePath || '';
      const rawUrl = pathSegment.startsWith('http')
        ? pathSegment
        : `${remoteFbxOrigin}${pathSegment}`;
      
      // Clean the URL: remove backticks and trim whitespace.
      const finalUrl = rawUrl.replace(/`/g, '').trim();
      
      

      // Determine file format from the URL.
      const fileExtension = finalUrl.split('.').pop()?.toLowerCase().trim();
      const format = fileExtension === 'fbx' ? 'fbx' : 'gltf';
      console.log(`[HomePage]haha ${boat.boatEnName}: ${finalUrl} with format: ${format}`);
      return {
        ...boat,
        id: boat.boatEnName,
        label: boat.boatName,
        url: finalUrl,
        format: format,
      };
    });
  }, [allBoats, remoteFbxOrigin]);

  const videos = siteContent?.videos ?? [];
  const siteSettings = normalizeSiteSettings(siteContent?.settings);
  const heroContent = normalizeHeroContent(siteContent?.hero);

  const primaryModel = models.find((m) => m.id === selectedModelId) ?? models[0] ?? null;

  // Diagnostic useEffect to track primaryModel changes
  useEffect(() => {
    console.log('[HomePage] primaryModel has been updated. New value:', primaryModel);
    if (primaryModel) {
      console.log(`[HomePage] -> The URL for the new primaryModel is: ${primaryModel.url}`);
    } else {
      console.log('[HomePage] -> The new primaryModel is null.');
    }
  }, [primaryModel]);

  const selectedModelLabel =
    getModelDisplayLabel(primaryModel) ||
    (models.length ? '选择船型' : '正在加载船型');
  const selectedModelPriceLabel = getModelPriceLabel(primaryModel);
  const brochurePath = resolveStaticPath(siteSettings.brochurePath);
  const heroImagePath = resolveStaticPath(siteSettings.heroImagePath);
  const specImagePath = primaryModel
    ? resolveStaticPath(getModelDetailImageAssetPath(primaryModel))
    : '';
  const viewerSpecItems = buildViewerSpecItems(primaryModel);
  const primaryDetailSpecCards = buildComparisonSpecSections(primaryModel);

  const maxCompareModelCount = siteSettings.compareLimit;
  const activeCategoryId =
    primaryModel
      ? getCategoryIdForModel(primaryModel)
      : modelsByCategory[0]?.id ?? null;

  const handleModelSelect = (modelId) => {
    console.log("[HomePage] handleModelSelect triggered with ID: ", modelId);
    if (!modelId || modelId === selectedModelId) {
      console.log("[HomePage] Aborting: modelId is same as current or invalid.");
      return
    }

    setSelectedModelId(modelId)
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
    return (
      <main className="capture-screen">
        <div className="capture-scene-shell">
          <ShipScene modelConfig={primaryModel} />
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
        <a className="btn primary" href="#experience">
          查看 3D 船型
        </a>
      </div>
    </div>
  );
}