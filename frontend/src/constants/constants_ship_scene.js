export const WATER_SURFACE_ENABLED = true;
export const EXTERIOR_STAGE_Y_OFFSET = 0.42;
export const EXTERIOR_TARGET_Y = 0.5 + EXTERIOR_STAGE_Y_OFFSET * 0.35;
export const EMPTY_ARRAY = [];
export const DEFAULT_WATER_TUNING = {
  levelFactor: 0.18,
  radiusScale: 0.84,
  zOffset: 0.16,
  exteriorModelLiftY: 0
};
// threejs ALPHA_MODE
export const UV_SET_ALPHA_MODE_OPAQUE = 'opaque';
export const UV_SET_ALPHA_MODE_CUTOUT = 'cutout';
export const UV_SET_ALPHA_MODE_BLEND = 'blend';
// threejs SIDE_MODE
export const UV_SET_SIDE_FRONT = 'front';
export const UV_SET_SIDE_DOUBLE = 'double';
// threejs DEPTH config
export const UV_SET_DEPTH_WRITE_ON = 'on';
export const UV_SET_DEPTH_WRITE_OFF = 'off';
export const UV_SET_DEPTH_TEST_ON = 'on';
export const UV_SET_DEPTH_TEST_OFF = 'off';
export const UV_SET_DITHER_MODE_ON = 'on';
export const UV_SET_DITHER_MODE_OFF = 'off';
// threejs CAMERA_MODE
export const CAMERA_MODE_ORBIT = 'orbit';
export const CAMERA_MODE_FIRST_PERSON = 'first-person';
// threejs FOCUS_COORDINATE_SPACE
export const FOCUS_COORDINATE_SPACE_SCENE = 'scene';
export const FOCUS_COORDINATE_SPACE_MODEL_LOCAL = 'model-local';
// threejs DEFAULT_CAMERA_ROTATION_DEGREES
export const DEFAULT_CAMERA_ROTATION_DEGREES = [0, 0, 0];
 
export const MODEL_WATER_TUNING = {
  PleasureBoat: {
    levelFactor: 0.06,
    exteriorModelLiftY: -0.02
  },
  PleasureBoat1: {
    exteriorModelLiftY: 0.1
  },
  Yacht: {
    exteriorModelLiftY: 0.06
  }
};

/**
 * 外部环绕观察模式下的默认相机参数。
 * 用于设置轨道控制（OrbitControls）相机的初始状态。
 *  updatePresentationOffset(...)
 *  applyExteriorCameraPreset(...)
 */
export const DEFAULT_EXTERIOR_CAMERA_PRESET = {
  position: [-6.2, 1.65, 1.7],
  zoom: 1.18,
  targetY: EXTERIOR_TARGET_Y,
  stageOffsetY: EXTERIOR_STAGE_Y_OFFSET
};

/**
 * “工作室外观”模式下的外部相机预设，同样用于设置轨道控制（OrbitControls）相机的初始状态。
 * 这为特定模型提供了一套替代默认值的参数，用于创建更干净、中性的产品展示效果。
 */
export const STUDIO_EXTERIOR_CAMERA_PRESET = {
  position: [-5.4, 1.32, 2.18],
  zoom: 1.34,
  targetY: 0.28,
  stageOffsetY: 0
};

/**
 * 内部第一人称漫游模式下的默认相机预设。
 * 键代表甲板层级，值定义了在该甲板上漫游时的初始相机状态。
 */
export const DEFAULT_INTERIOR_DECK_PRESETS = {
  '1': {
    position: [0, 0, -0.66],
    yaw: 0,
    pitch: -0.08
  },
  '2': {
    position: [0, 0.98, -0.66],
    yaw: 0,
    pitch: -0.08
  }
};

export const ENGINE_MODEL_LIBRARY = {
  'outboard-a': {
    format: 'fbx',
    path: '/gltf/TestHigh/马达（2048）/马达.fbx',
    targetHeightScale: 0.34,
    uvSets: [
      {
        id: 'tt',
        label: 'UV tt',
        directory: '/gltf/TestHigh/马达（2048）/tt',
        materialNameHint: 'M_07___Default',
        textures: {
          baseColor: '/gltf/TestHigh/马达（2048）/tt/WG_07 - Default_BaseColor.png',
          metalness: '/gltf/TestHigh/马达（2048）/tt/WG_07 - Default_Metallic.png',
          normal: '/gltf/TestHigh/马达（2048）/tt/WG_07 - Default_Normal.png',
          roughness: '/gltf/TestHigh/马达（2048）/tt/WG_07 - Default_Roughness.png'
        }
      }
    ]
  },
  'outboard-b': {
    format: 'fbx',
    path: '/gltf/TestHigh/马达（2048）/马达.fbx',
    targetHeightScale: 0.34,
    uvSets: [
      {
        id: 'tt',
        label: 'UV tt',
        directory: '/gltf/TestHigh/马达（2048）/tt',
        materialNameHint: 'M_07___Default',
        textures: {
          baseColor: '/gltf/TestHigh/马达（2048）/tt/WG_07 - Default_BaseColor.png',
          metalness: '/gltf/TestHigh/马达（2048）/tt/WG_07 - Default_Metallic.png',
          normal: '/gltf/TestHigh/马达（2048）/tt/WG_07 - Default_Normal.png',
          roughness: '/gltf/TestHigh/马达（2048）/tt/WG_07 - Default_Roughness.png'
        }
      }
    ]
  },
  'electric-outboard': {
    format: 'fbx',
    path: '/gltf/Dabao/dd.fbx',
    targetHeightScale: 0.34,
    uvSets: [
      {
        id: 'Texture',
        label: 'UV Texture',
        directory: '/gltf/Dabao/Texture',
        materialNameHint: 'diandong_19___Default',
        textures: {
          baseColor: '/gltf/Dabao/Texture/diandong_19 - Default_BaseColor.png',
          normal: '/gltf/Dabao/Texture/diandong_19 - Default_Normal.png',
          rmao: '/gltf/Dabao/Texture/diandong_19 - Default_R+M+AO.png'
        }
      }
    ]
  }
};

// 用于内部漫游的相机位置预设。
// 这个对象包含了两个 （'1' 和 '2'）的预设。 每个预设都定义了第一人称相机在内部漫游时
// 的初始位置 (position)、水平视角偏航角 (yaw) 和垂直视角俯仰角 (pitch)。
export const TEST_HIGH_INTERIOR_DECK_PRESETS = {
  '1': {
    position: [0, 0.78, -1.55],
    yaw: 0,
    pitch: -0.14
  },
  '2': {
    position: [0, 0.78, -1.55],
    yaw: 0,
    pitch: -0.14
  }
};