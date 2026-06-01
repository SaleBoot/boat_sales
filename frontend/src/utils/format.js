/**
 * 格式化文件大小
 * @param {number} value - 字节数
 * @returns {string} - 格式化后的字符串，例如 "1.2 MB"
 */
export function formatBytes(value) {
  const amount = Number(value) || 0;
  if (amount <= 0) {
    return '0 B';
  }

  const units = ['B', 'KB', 'MB', 'GB'];
  let unitIndex = 0;
  let current = amount;
  while (current >= 1024 && unitIndex < units.length - 1) {
    current /= 1024;
    unitIndex += 1;
  }

  const decimals = current >= 10 || unitIndex === 0 ? 0 : 1;
  return `${current.toFixed(decimals)} ${units[unitIndex]}`;
}

/**
 * 格式化数字（千分位）
 * @param {number} value - 要格式化的数字
 * @param {number} fractionDigits - 小数位数
 * @returns {string} - 格式化后的字符串
 */
export function formatNumber(value, fractionDigits = 0) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) {
    return '0';
  }

  return new Intl.NumberFormat('zh-CN', {
    minimumFractionDigits: 0,
    maximumFractionDigits: fractionDigits,
  }).format(numeric);
}

/**
 * 格式化日期和时间
 * @param {string | Date} value - 日期字符串或 Date 对象
 * @returns {string} - 格式化后的字符串，例如 "2026/05/23 14:00"
 */
export function formatDateTime(value) {
  if (!value) {
    return '未记录';
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return new Intl.DateTimeFormat('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date);
}



function getParentDirName(path) {
  // const modelRuntimePath = "/gltf01/firefighting/firefighting01/13.fbx";
  // console.log(getParentDirName(modelRuntimePath)); // 输出: firefighting01
  // 1. 按斜杠分割成数组
  const parts = path.split('/'); 
  // parts 结果为: ["", "gltf01", "firefighting", "firefighting01", "13.fbx"]

  // 2. 数组最后一个是文件名 (13.fbx)，倒数第二个就是父目录
  // 使用 slice(-2, -1) 可以安全地获取倒数第二个元素
  
  return parts[parts.length - 2];
}

