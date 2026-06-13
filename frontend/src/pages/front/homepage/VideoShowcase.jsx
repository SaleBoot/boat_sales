import React, { useState } from 'react';

// Helper function to get the correct embed URL for different video platforms
const getVideoEmbedSrc = (videoUrl, autoplay = 0) => {
  if (!videoUrl) return '';

  let embedUrl = '';
  try {
    const url = new URL(videoUrl);

    if (url.hostname.includes('youtube.com') || url.hostname.includes('youtu.be')) {
      let videoId = url.searchParams.get('v');
      if (!videoId && url.hostname.includes('youtu.be')) {
        videoId = url.pathname.split('/').pop();
      }
      if (videoId) {
        embedUrl = `https://www.youtube.com/embed/${videoId}?autoplay=${autoplay}&rel=0`;
      }
    } else if (url.hostname.includes('bilibili.com')) {
      const videoId = url.pathname.split('/').find(part => part.startsWith('BV'));
      if (videoId) {
        embedUrl = `//player.bilibili.com/player.html?bvid=${videoId}&page=1&autoplay=${autoplay}&high_quality=1&danmaku=0`;
      }
    }
  } catch (e) {
    console.error("Error parsing video URL:", videoUrl, e);
    return '';
  }
  return embedUrl;
};

/**
 * 一个专门用于展示视频资料的组件。
 *
 * @param {Array} videos - 包含视频信息的数组。
 */
export default function VideoShowcase({ videos }) 
{
  const [playingVideoId, setPlayingVideoId] = useState(null);
  if (!videos || videos.length === 0) {
    return null;
  }

  return (
    <section className="video-showcase" aria-label="外部视频展示">
      <div className="video-section-header">
        <div>
          <p className="detail-kicker">影像资料</p>
          <h3 style={{ color: 'white' }}>航行与任务场景视频</h3>
        </div>
        <p className="video-section-copy">
          通过航行、靠泊、任务执行与细节镜头，辅助客户理解船型在真实使用场景中的状态与质感。
        </p>
      </div>

      <div className="video-grid">
        {videos.map((video) => (
          <article key={video.id} className="video-card">
            <div className="video-frame-shell">
              {playingVideoId === video.id ? (
                <iframe
                  className="video-frame"
                  src={getVideoEmbedSrc(video.url, 0)}
                  title={video.title} 
                  allow="fullscreen;"
                  style={{ width: '100%', height: '100%', border: 'none' }}
                />
              ) : (
                <div
                  className="video-placeholder"
                  onClick={() => setPlayingVideoId(video.id)}
                  style={{
                    cursor: 'pointer',
                    position: 'relative',
                    width: '100%',
                    paddingBottom: '56.25%', /* 16:9 Aspect Ratio */
                    backgroundColor: '#000',
                    display: 'flex',
                    justifyContent: 'center',
                    alignItems: 'center',
                  }}
                >
                  <div style={{
                    fontSize: '3em',
                    color: 'white',
                    border: '2px solid white',
                    borderRadius: '50%',
                    padding: '0.2em 0.4em',
                  }}>▶</div>
                </div>
              )}
            </div>
            <div className="video-card-caption">
              <h4>{video.title}</h4>
              <p>{video.introduction}</p>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}