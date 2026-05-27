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
  console.log("即将发送到后端的用户数据:", userData);
  return api.post('/admin/users', userData);
};

/**
 * 删除用户
 * @param {Array<number>} userIds - 用户ID列表
 * @returns {Promise<any>}
 */
export const deleteUsers = (userIds) => {
  // 使用 POST 方法来处理批量删除
  return api.post('/admin/users/delete', { userIds });
};

// ------------------------------------------------
/**
 * 根据 Email 获取用户信息
 * @param {string} email - 用户邮箱
 * @returns {Promise<any>}
 */
export const getUserByEmail = (email) => {
  return api.get(`/admin/users/${email}`);
};

/**
 * 根据 Email 更新用户信息
 * @param {string} email - 用户邮箱
 * @param {object} profileData - 用户信息
 * @returns {Promise<any>}
 */
export const updateUserByEmail = (email, profileData) => {
  return api.post(`/admin/users/${email}`, profileData);
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
  return api.post('/admin/boats/delete', { boatIds });
};

/**
 * 更新船舶信息
 * @param {number} id - 船舶ID
 * @param {object} boatData - 船舶数据
 * @returns {Promise<any>}
 */
export const updateBoat = (id, boatData) => {
  return api.post(`/admin/boats/${id}`, boatData);
};

// -------------------------------------------------------
// 船舶类型管理 (Boat Categories)
// -------------------------------------------------------

/**
 * 获取船舶类型列表
 * @param {object} params - 查询参数
 * @returns {Promise<any>}
 */
export const getBoatCategories = (params) => {
  return api.get('/admin/boat-categories', { params });
};

/**
 * 添加新船舶类型
 * @param {object} categoryData - 船舶类型数据
 * @returns {Promise<any>}
 */
export const addBoatCategory = (categoryData) => {
  return api.post('/admin/boat-categories', categoryData);
};

/**
 * 更新船舶类型
 * @param {number} id - 船舶类型ID
 * @param {object} categoryData - 更新的船舶类型数据
 * @returns {Promise<any>}
 */
export const updateBoatCategory = (id, categoryData) => {
  return api.post(`/admin/boat-categories/${id}`, categoryData);
};

/**
 * 删除船舶类型
 * @param {Array<number>} ids - 船舶类型ID列表
 * @returns {Promise<any>}
 */
export const deleteBoatCategories = (ids) => { 
  return api.post('/admin/boat-categories/delete', { ids });
};

// -------------------------------------------------------
// 文件上传 (COS)
// -------------------------------------------------------

/**
 * 获取 COS 预签名上传 URL
 * @param {string} modelName - 船舶的模型名
 * @param {string} fileName - 清洗后的纯文件名
 * @returns {Promise<any>}
 */
export const getCosPresignedUrl = (modelName, fileName) => {
  return api.get('/admin/cos/presigned-url', {
    params: { modelName, fileName }
  });
};