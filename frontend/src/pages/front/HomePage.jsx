import HomepageHeader       from './homepage/HomepageHeader'
import HomePageHeroScreen   from './homepage/HomePageHeroScreen'
import HomePageViewerScreen from './homepage/HomePageViewerScreen'
import DetailSpecShowcase   from './homepage/DetailSpecShowcase'
import DetailCompareStack   from './homepage/DetailCompareStack'
import VideoShowcase        from './homepage/VideoShowcase'
import ShipScene            from '../scene3d/ShipScene'

export default function HomePage({
  // Data props
  modelsByCategory,
  activeCategoryId,
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
  videos,
  captureMode,

  // State props
  openCategoryId,
  openCompareSelectId,

  // Handler props
  setOpenCategoryId,
  handleModelSelect,
  scrollToExperience,
  setOpenCompareSelectId,
  handleCompareSelectToggle,
  resolveStaticPath,
}) {

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
