import axios from 'axios';

/**
 * 使用预签名 URL 直接上传文件到云存储
 * @param {string} presignedUrl - 后端返回的完整预签名 URL
 * @param {File} file - 要上传的文件对象
 * @returns {Promise<any>} - 返回 axios 的响应
 */
export const uploadByPresignedUrl = async (presignedUrl, file) => {
  // 直接、干净地使用 axios.put，只设置 Content-Type
  // 浏览器会自动处理 Host 等不安全头
  return axios.put(presignedUrl, file, {
    headers: {
      'Content-Type': file.type || 'application/octet-stream'
    }
  });
};