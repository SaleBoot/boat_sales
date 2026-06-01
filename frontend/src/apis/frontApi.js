// ------------------------------------------------
// 后台管理相关API接口
// ------------------------------------------------
import api from '../utils/requestApi';

// ------------------------------------------------
// 
// ------------------------------------------------
/**
 * @typedef {object} ModelFrontOut
 * @property {string} boatEnName
 * @property {string} modelName
 * @property {string} modelRuntimePath
 * @property {Object<string, string[]>} modelMatSlots
 * @property {string} exteriorName
 * @property {string} exteriorDescr
 * @property {number} exteriorAddedPrice
 * @property {string} interiorName
 * @property {string} interiorDescr
 * @property {number} interiorAddedPrice
 * @property {string} deckName
 * @property {string} deckDescr
 * @property {number} deckAddedPrice
 * @property {string} powerName
 * @property {string} powerDescr
 * @property {number} powerAddedPrice
 */

/**
 * @typedef {object} BoatFrontOut
 * @property {string} boatName
 * @property {string} boatEnName
 * @property {number} price
 * @property {string} description
 * @property {number} overallLength
 * @property {number} waterlineLength
 * @property {number} beam
 * @property {number} moldedDepth
 * @property {number} draft
 * @property {string} navigationArea
 * @property {string} mainEnginePower
 * @property {number} designSpeed
 * @property {number} ratedCrew
 * @property {string} propulsionType
 * @property {string} material
 * @property {string} certificateType
 * @property {ModelFrontOut[]} models
 */

/**
 * @typedef {object} ModelsFrontOutput
 * @property {Object<string, string>} categories
 * @property {Object<string, BoatFrontOut[]>} boats
 */

/**
 * 获取前端船只模型列表
 * @returns {Promise<ModelsFrontOutput>}
 */
export const getFrontBoatModels = () => {
  return api.get('/front/boat-models');
};