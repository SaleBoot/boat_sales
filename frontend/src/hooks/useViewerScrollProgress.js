import { useEffect } from 'react';

/**
 * 一个自定义 Hook，用于跟踪一个元素的滚动进度并更新一个 CSS 自定义属性。
 * @param {React.RefObject<HTMLElement>} targetRef - 指向要跟踪其滚动进度的 DOM 元素的 ref。
 */
export function useViewerScrollProgress(targetRef) {
  useEffect(() => {
    // 确保 ref 指向的元素存在
    if (!targetRef.current) {
      return undefined;
    }

    const targetElement = targetRef.current;
    let frameId = 0;

    const updateViewerScaleProgress = () => {
      frameId = 0;

      const rect = targetElement.getBoundingClientRect();
      const viewportHeight = window.innerHeight || 1;
      // 计算元素可见高度与视口高度的差值，作为滚动的有效范围
      const scrollSpan = Math.max(rect.height - viewportHeight, 1);
      // 计算元素顶部移出视口顶部的距离占滚动范围的比例
      const revealProgress = Math.min(Math.max((-rect.top) / scrollSpan, 0), 1);

      // 将计算出的进度值（保留三位小数）设置为 CSS 变量
      targetElement.style.setProperty('--viewer-scroll-progress', revealProgress.toFixed(3));
    };

    const requestUpdate = () => {
      // 如果已经有一个动画帧在排队，则不再请求新的
      if (frameId) {
        return;
      }
      // 使用 requestAnimationFrame 来优化性能，避免在每次滚动事件中都进行重绘
      frameId = window.requestAnimationFrame(updateViewerScaleProgress);
    };

    // 初始化
    requestUpdate();
    // 监听滚动和窗口大小变化事件
    window.addEventListener('scroll', requestUpdate, { passive: true });
    window.addEventListener('resize', requestUpdate);

    // 清理函数：在组件卸载时移除事件监听器
    return () => {
      if (frameId) {
        window.cancelAnimationFrame(frameId);
      }
      window.removeEventListener('scroll', requestUpdate);
      window.removeEventListener('resize', requestUpdate);
    };
  }, [targetRef]); // 依赖于 targetRef，确保 ref 变化时能重新绑定
}
