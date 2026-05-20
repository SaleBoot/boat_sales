import { useEffect, useState } from 'react';
import { getModelDisplayLabel } from '../../../utils/utils_model';

export default function HomepageHeader({
  modelsByCategory,
  activeCategoryId,
  openCategoryId,
  setOpenCategoryId,
  handleModelSelect,
  scrollToExperience,
  selectedModelId,  
  brochurePath,
}) {
  const [isScrolled, setIsScrolled] = useState(false);

  // ------------------
  useEffect(() => {
    const onScroll = () => {
      setIsScrolled(window.scrollY > 12);
    };

    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });

    return () => {
      window.removeEventListener('scroll', onScroll);
    };
  }, []);

  // ------------------
  const handleCategoryTriggerClick = (category) => {
    if (!category) {
      return
    }

    if (category.models.length === 1) {
      handleModelSelect(category.models[0].id)
      setOpenCategoryId(null)
      scrollToExperience()
      return
    }

    setOpenCategoryId((current) => (current === category.id ? null : category.id))
    scrollToExperience()
  }
  // 
  const handleCategoryItemClick = (modelId) => {
    handleModelSelect(modelId)
    setOpenCategoryId(null)
    scrollToExperience()
  }
  // ------------------

  return (
    <header className={`site-nav ${isScrolled ? 'is-scrolled' : ''}`}>
      <div className="site-nav-inner">
        <div className="site-nav-left">
          <nav className="site-categories" aria-label="船型分类">
            {modelsByCategory.map((category) => {
              const isActiveCategory = category.id === activeCategoryId;
              const isOpen = openCategoryId === category.id;

              return (
                <div
                  key={category.id}
                  className={`site-category-group ${isActiveCategory ? 'is-active' : ''} ${isOpen ? 'is-open' : ''}`}
                  onMouseEnter={() => setOpenCategoryId(category.id)}
                  onMouseLeave={() => setOpenCategoryId((current) => (current === category.id ? null : current))}
                >
                  <button
                    type="button"
                    className="site-category-trigger"
                    onClick={() => handleCategoryTriggerClick(category)}
                    aria-expanded={isOpen}
                    aria-haspopup="menu"
                  >
                    <span>{category.label}</span>
                    <span className="site-category-caret" aria-hidden="true">▾</span>
                  </button>

                  <div className="site-category-dropdown" role="menu" aria-label={category.label}>
                    {category.models.map((model) => {
                      const isActiveModel = model.id === selectedModelId;

                      return (
                        <button
                          key={model.id}
                          type="button"
                          className={`site-category-option ${isActiveModel ? 'active' : ''}`}
                          onClick={() => handleCategoryItemClick(model.id)}
                          role="menuitem"
                        >
                          <span>{getModelDisplayLabel(model)}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </nav>
        </div>

        <a className="brand" href="#top">京穗船舶</a>

        <div className="site-nav-right">
          <nav className="site-links" aria-label="主导航">
            <a href="#poster">首页</a>
            <a href="#experience">3D 看船</a>
            <a href="#details">参数对比</a>
            <a href="#/admin">后台管理</a>
          </nav>
          <a className="mini-btn" href={brochurePath} download>下载资料</a>
        </div>
      </div>
    </header>
  );
}