import Scene from './Scene.js?v=1.2.14';

const container = document.getElementById('previewCanvas');
let scene3d = null;
let variant = null;

function notify(message) {
  window.parent.postMessage(message, location.origin);
}

async function loadVariant(nextVariant) {
  variant = structuredClone(nextVariant || {});
  try {
    if (scene3d) scene3d.destroy();
    scene3d = new Scene(container);
    await scene3d.loadVariant(variant);
    scene3d.setCameraMode('exterior');
    notify({ type: 'model-preview-ready' });
  } catch (error) {
    notify({ type: 'model-preview-error', message: error && error.message ? error.message : String(error) });
  }
}

window.addEventListener('message', event => {
  if (event.origin !== location.origin) return;
  const message = event.data || {};
  if (message.type === 'model-preview-load') loadVariant(message.variant);
  if (!scene3d || !variant) return;
  if (message.type === 'model-preview-direction') {
    variant.viewSettings = variant.viewSettings || {};
    variant.viewSettings.bowDirection = message.bowDirection;
    scene3d.currentVariant = variant;
  }
  if (message.type === 'model-preview-mode') scene3d.setCameraMode(message.mode);
  if (message.type === 'model-preview-navigation') scene3d.setFirstPersonNavigation(Boolean(message.enabled));
  if (message.type === 'model-preview-capture') {
    notify({ type: 'model-preview-pose', mode: message.mode, pose: scene3d.captureCameraPose() });
  }
});
