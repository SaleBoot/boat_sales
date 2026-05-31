export const getGrandparentPath = (path) => {
    if (!path) return "/";

    const parts = path.split('/');
    
    // 如果 parts 长度小于 3，说明路径层级不够 (例如："/a.fbx" 分割后长度为 2)
    if (parts.length <= 2) {
        // 根据你的业务逻辑决定：是返回根目录 "/" 还是原样返回
        return "/"; 
    }

    return parts.slice(0, -2).join('/') + '/';
};