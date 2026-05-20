import React from 'react';

/**
 * 一个专门用于展示视频资料的组件。
 *
 * @param {Array} videos - 包含视频信息的数组。
 */
export default function VideoShowcase({ videos }) 
{
  if (!videos || videos.length === 0) {
    return null;
  }

  return (
    <section className="video-showcase" aria-label="外部视频展示">
      <div className="video-section-header">
        <div>
          <p className="detail-kicker">影像资料</p>
          <h3>航行与任务场景视频</h3>
        </div>
        <p className="video-section-copy">
          通过航行、靠泊、任务执行与细节镜头，辅助客户理解船型在真实使用场景中的状态与质感。
        </p>
      </div>

      <div className="video-grid">
        {videos.map((video) => (
          <article key={video.id} className="video-card">
            <div className="video-frame-shell">
              <iframe
                className="video-frame"
                src={video.embedUrl}
                title={video.title}
                loading="lazy"
                referrerPolicy="strict-origin-when-cross-origin"
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                allowFullScreen
              />
            </div>
            <div className="video-card-caption">
              <h4>{video.title}</h4>
              <p>{video.description}</p>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}
