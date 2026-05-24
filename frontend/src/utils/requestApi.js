import axios from 'axios';

// 创建一个 axios 实例
const instance = axios.create({
  baseURL: '/api', // 公共前缀
  timeout: 90000,  // 请求超时时间
  withCredentials: true, // 关键：允许跨域请求携带和接收Cookie
});

// --- 请求拦截器 ---
// 可以在这里统一处理 Token 的附加
instance.interceptors.request.use(
  (config) => {
    // 例如: 从 localStorage 或状态管理中获取 token
    // const token = localStorage.getItem('token');
    // if (token) {
    //   config.headers.Authorization = `Bearer ${token}`;
    // }
    return config;
  },
  (error) => {
    // 对请求错误做些什么
    console.error('[Axios Request Error]', error);
    return Promise.reject(error);
  }
);

// --- 响应拦截器 ---
// 在这里统一处理响应数据和错误
instance.interceptors.response.use(
  (response) => {
    const res = response.data;

    // 如果响应数据没有 'code' 属性 (例如请求一个静态 .json 文件)
    // 直接返回整个响应数据
    if (res.code === undefined) {
      return res;
    }

    // 如果 code 是 200 或 0，代表业务成功
    // 直接返回 'data' 字段的内容，简化组件中的使用
    if (res.code === 200 || res.code === 0) {
      return res.data;
    }

    // 如果 code 不是成功状态，说明是业务逻辑错误
    // 创建一个错误对象并抛出，由调用方的 .catch() 捕获
    console.error('[Axios Business Error]', res.message || 'Service Exception');
    return Promise.reject(new Error(res.message || 'Error'));
  },
  (error) => {
    // 这里处理的是 HTTP 层面或网络层面的错误 (e.g., 404, 500, timeout)
    if (error.response) {
      // 请求已发出，但服务器响应的状态码不在 2xx 范围内
      const status = error.response.status;
      console.error(`[Axios HTTP Error ${status}]`, error.response.data);

      if (status === 401) {
        // 对于 401 未授权错误，可以进行特殊处理
        // 例如，触发一个全局的登出事件，或直接跳转到登录页
        // 注意：在这里直接跳转路由不是最佳实践，最好是通知 AuthContext 来处理
        console.error('Unauthorized access - 401. Redirecting to login might be needed.');
      }
    } else if (error.request) {
      // 请求已发出，但没有收到响应
      console.error('[Axios Network Error]', 'No response received', error.request);
    } else {
      // 在设置请求时触发了一个错误
      console.error('[Axios Setup Error]', error.message);
    }
    
    // 抛出错误，让调用方可以捕获
    return Promise.reject(error);
  }
);

export default instance;