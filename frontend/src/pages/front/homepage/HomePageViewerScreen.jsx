import { useEffect, useMemo, useRef, useState } from 'react';
import { useViewerScrollProgress } from '../../../hooks/useViewerScrollProgress';
import { useFocusTarget } from '../../../hooks/useFocusTarget';
import ShipScene from '../../scene3d/ShipScene';
import { buildModel4ShipScene } from "../../../utils/utils_ship_scene";

export default function HomePageViewerScreen({
  selectedModelGid,
  primaryModel,
  runtimeBasePath,
  remoteFbxOrigin, // Added for resolving model paths
  selectedModelLabel,
  selectedModelPriceLabel,
  viewerSpecItems,
}) {
  const [sceneViewToggleTarget, setSceneViewToggleTarget] = useState(null);
  const viewerScreenRef = useRef(null);

  const { viewerFocusTarget, 
    setViewerFocusTarget, 
    viewerFocusTargets 
  } = useFocusTarget( selectedModelGid, primaryModel, runtimeBasePath);
 
 
  const modelConfig = useMemo(() => {
    return buildModel4ShipScene(
      primaryModel?.primaryModelInfo,
      remoteFbxOrigin
    );
  }, [primaryModel?.primaryModelInfo?.id, remoteFbxOrigin]);

  useEffect(() => { 
    console.log('HomePageViewerScreen.jsx modelConfig', modelConfig);
    if (!modelConfig) 
    {
      return;
    }

  }, [modelConfig]);


  // 使用自定义 Hook 来处理滚动进度效果
  useViewerScrollProgress(viewerScreenRef);

  return (
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
          modelConfig={modelConfig}
          viewTogglePortalTarget={sceneViewToggleTarget}
          focusTarget={viewerFocusTarget}
          focusTargetPresets={viewerFocusTargets}
          focusTargetStrategy="console-driven"
          onFocusTargetChange={setViewerFocusTarget}
        />
      </div>
    </section>
  );
}