import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { getBoatDisplayLabel } from '../../../utils/utils_homepage';

export default function HomepageHeader({
  categoryMenus = [],
  activeCategoryId,
  openCategoryId,
  setOpenCategoryId,
  handleModelSelect,
  scrollToExperience,
  selectedModelGid,  
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

    if (category.boats.length === 1) {
      handleModelSelect({ boatId: category.boats[0].id, modelId: "" })
      setOpenCategoryId(null)
      scrollToExperience()
      return
    }

    setOpenCategoryId((current) => (current === category.id ? null : category.id))
    scrollToExperience()
  }
  // 
  const handleCategoryItemClick = (boatId) => {
    handleModelSelect({ boatId: boatId, modelId: "" })
    setOpenCategoryId(null)
    scrollToExperience()
  }
  // ------------------

  return (
    <header className={`site-nav ${isScrolled ? 'is-scrolled' : ''}`}>
      <div className="site-nav-inner">
        <div className="site-nav-left">
          <nav className="site-categories" aria-label="船型分类">
            {categoryMenus.map((category) => {
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

                  <div
                    className="site-category-dropdown"
                    role="menu"
                    aria-label={category.label}
                  
                  >
                    {category.boats?.map((boat) => {
                      const isActiveModel = boat.id === selectedModelGid.boatId;

                      return (
                        <button
                          key={boat.id}
                          type="button"
                          className={`site-category-option ${isActiveModel ? 'active' : ''}`}
                          onClick={() => handleCategoryItemClick(boat.id)}
                          role="menuitem"
                        >
                          <span>
                            {getBoatDisplayLabel(boat)}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </nav>
        </div>

        <Link className="brand" to="/">京穗船舶</Link>

        <div className="site-nav-right">
          <nav className="site-links" aria-label="主导航">
            <a href="#poster">首页</a>
            <a href="#experience">3D 看船</a>
            <a href="#details">参数对比</a>
            <Link to="/admin">后台管理</Link>
          </nav>
          <a className="mini-btn" href={brochurePath} download>下载资料</a>
        </div>
      </div>
    </header>
  );
}