export default function HomePageHeroScreen({ heroImagePath, heroContent, scrollToExperience }) {
  return (
    <section className="hero-screen" id="poster">
      <img className="hero-poster" src={heroImagePath} alt="京穗船舶产品展示图" />
      <div className="hero-overlay" />
      <div className="hero-aurora" aria-hidden="true">
        <span className="hero-aurora-orb hero-aurora-orb-1" />
        <span className="hero-aurora-orb hero-aurora-orb-2" />
        <span className="hero-aurora-ring" />
      </div>

      <div className="hero-content">
        <p className="hero-kicker reveal reveal-1">{heroContent.kicker}</p>
        <h1 className="reveal reveal-2">{heroContent.heading}</h1>
        <p className="hero-slogan reveal reveal-3">{heroContent.summary}</p>
        <div className="hero-proof-strip reveal reveal-4" aria-label="平台能力">
          {heroContent.proofPoints.map((item) => (
            <span key={item}>{item}</span>
          ))}
        </div>
        <div className="hero-actions reveal reveal-4">
          <a className="btn primary" href="#experience">{heroContent.primaryButtonLabel}</a>
          <a className="btn order-btn" href="#/order">{heroContent.secondaryButtonLabel}</a>
        </div>
      </div>

      <a className="scroll-cue reveal reveal-4" href="#experience">
        <span className="scroll-cue-line" />
        <span>{heroContent.scrollCueLabel}</span>
      </a>
    </section>
  );
}
