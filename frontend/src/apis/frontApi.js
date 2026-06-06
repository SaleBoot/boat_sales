// ------------------------------------------------
// 后台管理相关API接口
// ------------------------------------------------
import { getJsonFile } from './pureAxiosApi';
import api from '../utils/requestApi';

// ------------------------------------------------
// 
// ------------------------------------------------
/**
 * @typedef {object} TextureSet - Defines paths for all PBR texture channels.
 * @property {string} basecolor - Base color texture path.
 * @property {string} normal - Normal map texture path.
 * @property {string} roughness - Roughness map texture path.
 * @property {string} metalness - Metalness map texture path.
 * @property {string} ao - Ambient Occlusion map texture path.
 * @property {string} emissive - emissive map texture path.
 */

/**
 * @typedef {object} MatSlot - Represents a customizable material slot on a model.
 * @property {string} matName - The name of the material slot.
 * @property {TextureSet} textures - The set of textures for this material.
 */

/**
 * @typedef {object} ModelInfo - Represents a specific, configurable model variant of a boat.
 * @property {string} id - Unique ID for the model (e.g., boatEnName + index).
 * @property {string} label - The display name of the model (ModelName).
 * @property {string} boatEnName - The English name of the boat, also the model folder name.
 * @property {string} modelName - The name of the default style.
 * @property {string[]} adImgs - Advertising images.
 * @property {string[]} partPaths - List of runtime paths for model parts.
 * @property {MatSlot[]} matSlots - List of material slots for customization.
 * @property {string} exteriorName - Name of the exterior option.
 * @property {string} exteriorDescr - Description of the exterior option.
 * @property {number} exteriorAddedPrice - Added price for the exterior option.
 * @property {string} interiorName - Name of the interior option.
 * @property {string} interiorDescr - Description of the interior option.
 * @property {number} interiorAddedPrice - Added price for the interior option.
 * @property {string} deckName - Name of the deck option.
 * @property {string} deckDescr - Description of the deck option.
 * @property {number} deckAddedPrice - Added price for the deck option.
 * @property {string} powerName - Name of the power/engine option.
 * @property {string} powerDescr - Description of the power/engine option.
 * @property {number} powerAddedPrice - Added price for the power/engine option.
 */

/**
 * @typedef {object} BoatInfo - Contains all detailed information for a single boat type.
 * @property {string} id - The boat's English name (boat.boatEnName).
 * @property {string} label - The boat's Chinese name (boat.boatName).
 * @property {string} category - The English name of the boat's category.
 * @property {number} price - Base price of the boat.
 * @property {string} description - A text description of the boat.
 * @property {number} overallLength - Overall length.
 * @property {number} waterlineLength - Waterline length.
 * @property {number} beam - Beam width.
 * @property {number} moldedDepth - Molded depth.
 * @property {number} draft - Draft.
 * @property {string} navigationArea - Navigation area.
 * @property {string} mainEnginePower - Main engine power specification.
 * @property {number} designSpeed - Design speed.
 * @property {number} ratedCrew - Rated crew capacity.
 * @property {string} propulsionType - Type of propulsion.
 * @property {string} material - Hull material.
 * @property {string} certificateType - Type of certification.
 * @property {ModelInfo[]} models - A list of available model configurations for this boat.
 */

/**
 * @typedef {Object<string, BoatInfo>} BoatMap
 * A map where the key is the boat's English name (id) and the value is the full BoatInfo object.
 */

/**
 * @typedef {object} BoatSubMenu - A simplified boat representation for the navigation menu.
 * @property {string} id - The boat's English name (boat.boatEnName).
 * @property {string} label - The boat's Chinese name (boat.boatName).
 */

/**
 * @typedef {object} BoatMenu - Represents a single category in the navigation menu.
 * @property {string} id - The category's ID (category.CategoryStrID).
 * @property {string} label - The category's Chinese name (category.CnName).
 * @property {BoatSubMenu[]} boats - A list of boats in this category for the menu.
 */

/**
 * @typedef {object} Models4Front - The root object returned by the getFrontBoatModels API.
 * @property {BoatMenu[]} menu - Data structure for building the navigation menu.
 * @property {BoatMap} boatMap - A map for quick lookup of boat details by their ID.
 */

/**
 * Fetches the complete boat model data for the frontend.
 * This includes the menu structure and a map for quick lookups.
 * @returns {Promise<Models4Front>} A promise that resolves to the comprehensive boat data object.
 */
export const getFrontBoatModels = () => {
  return api.get('/front/boat-models');
};

/**
 * Fetches the complete boat model data for the frontend.
 * This includes the menu structure and a map for quick lookups.
 * @param {string} boatId - The ID of the boat.
 * @param {string} [modelId] - The optional ID of the specific model variant.
 * @returns {Promise<Models4Front>} A promise that resolves to the comprehensive boat data object.
 */
export const getFocusTargets = (boatId, modelId) => {
  return api.get('/front/model/focus-targets', {
    params: { boatId, modelId },
  });
};



/**
 * @typedef {object} SiteContent
 * @property {object} header
 * @property {string} header.logoUrl
 * @property {Array<{label: string, href: string}>} header.navLinks
 * @property {object} footer
 * @property {string} footer.copyright
 * @property {Array<{label: string, href: string}>} footer.links
 */

/**
 * 获取网站的通用内容，如页眉页脚
 * @returns {Promise<SiteContent>}
 */
export const getSiteContent = async () => {
  return getJsonFile('/app-json/site-content.json');
};