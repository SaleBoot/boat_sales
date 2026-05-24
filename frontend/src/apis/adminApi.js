// ------------------------------------------------
// 后台管理相关API接口
// ------------------------------------------------
import api from '../utils/requestApi';

// ------------------------------------------------
// 这里定义了管理员登录、登出
// ------------------------------------------------
/**
 * 调用后台登录接口
 * @param {string} email - 管理员邮箱
 * @param {string} password - 密码
 * @returns {Promise<any>} - 返回后台响应的数据
 */
export const loginApi = ({ email, password }) => {
  return api.post('/admin/auth/login', { email, password });
};

/**
 * 调用后台登出接口
 * @returns {Promise<any>}
 */
export const logoutApi = () => {
  return api.post('/admin/auth/logout');
};
// ------------------------------------------------
/**
 * 获取后台看板的内容数据（资源总览）
 * @returns {Promise<any>}
 */
export const getDashboardContent = () => {
  return api.get('/admin/models/overview');
}

/**
 * 获取后台看板的销售数据（订单状态）
 * @returns {Promise<any>}
 */
export const getDashboardSales = () => {
  return api.get('/admin/orders');
}

// ------------------------------------------------
/**
 * 获取用户列表
 * @returns {Promise<any>}
 */
export const getUsers = () => {
  return api.get('/admin/users');
};

/**
 * 添加新用户
 * @param {object} userData - 用户数据
 * @returns {Promise<any>}
 */
export const addUser = (userData) => {
  return api.post('/admin/users', userData);
};

/**
 * 删除用户
 * @param {Array<number>} userIds - 用户ID列表
 * @returns {Promise<any>}
 */
export const deleteUsers = (userIds) => {
  return api.delete('/admin/users', { data: { userIds } });
};

// ------------------------------------------------
/**
 * 获取船舶列表
 * @param {object} params - 查询参数，例如 { q: 'searchText' }
 * @returns {Promise<any>}
 */
export const getBoats = (params) => {
  return api.get('/admin/boats', { params });
};

/**
 * 添加新船舶
 * @param {object} boatData - 船舶数据
 * @returns {Promise<any>}
 */
export const addBoat = (boatData) => {
  return api.post('/admin/boats', boatData);
};

/**
 * 删除船舶
 * @param {Array<number>} boatIds - 船舶ID列表
 * @returns {Promise<any>}
 */
export const deleteBoats = (boatIds) => {
  return api.delete('/admin/boats', { data: { boatIds } });
};

// -------------------------------------------------------