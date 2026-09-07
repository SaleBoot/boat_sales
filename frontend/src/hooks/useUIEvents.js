import { useEffect } from 'react';

/**
 * 一个自定义 Hook，用于实现全局鼠标指针发光效果。
 * 它会监听 'pointermove' 事件，并更新 CSS 自定义属性
 * `--cursor-x` 和 `--cursor-y` 来反映指针的当前位置。
 *
 * 这个 Hook 应该在应用的根组件中调用一次，以确保效果全局可用。
 */
export function usePointerGlow() {
  useEffect(() => {
    let animationFrameId = 0;

    const updatePointerGlow = (event) => {
      if (animationFrameId) {
        window.cancelAnimationFrame(animationFrameId);
      }

      animationFrameId = window.requestAnimationFrame(() => {
        document.documentElement.style.setProperty('--cursor-x', `${event.clientX}px`);
        document.documentElement.style.setProperty('--cursor-y', `${event.clientY}px`);
      });
    };

    window.addEventListener('pointermove', updatePointerGlow, { passive: true });

    // 清理函数：在组件卸载时移除监听器并取消动画帧
    return () => {
      if (animationFrameId) {
        window.cancelAnimationFrame(animationFrameId);
      }
      window.removeEventListener('pointermove', updatePointerGlow);
    };
  }, []); // 空依赖数组确保此 effect 只在挂载和卸载时运行一次
}

/**
 * 一个自定义 Hook，用于处理全局菜单关闭逻辑。
 * 当用户点击特定菜单区域之外或按下 'Escape' 键时，
 * 它会调用传入的状态设置函数来关闭菜单。
 *
 * @param {Function} setOpenCategoryId - 用于设置打开的类别菜单 ID 的状态函数。
 * @param {Function} setOpenCompareSelectId - 用于设置打开的比较选择菜单 ID 的状态函数。
 */
export function useGlobalMenuClose(setOpenCategoryId, setOpenCompareSelectId) {
    

  useEffect(() => {
    const closeMenusOnOutsideInteraction = (event) => {
      if (
        !(event.target instanceof Element) ||
        event.target.closest('.site-category-group') ||
        event.target.closest('.detail-compare-select-group')
      ) {
        return;
      }

      setOpenCategoryId(null);
      setOpenCompareSelectId(null);
    };

    const closeMenusOnEscape = (event) => {
      if (event.key === 'Escape') {
        setOpenCategoryId(null);
        setOpenCompareSelectId(null);
      }
    };

    document.addEventListener('pointerdown', closeMenusOnOutsideInteraction);
    document.addEventListener('keydown', closeMenusOnEscape);

    return () => {
      document.removeEventListener('pointerdown', closeMenusOnOutsideInteraction);
      document.removeEventListener('keydown', closeMenusOnEscape);
    };
    // 依赖项包含状态设置函数，以确保在它们发生变化时（虽然不太可能）
    // 能够重新绑定事件监听器。
  }, [setOpenCategoryId, setOpenCompareSelectId]);
}