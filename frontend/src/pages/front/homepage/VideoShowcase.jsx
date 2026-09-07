import React, { useEffect, useState } from 'react';
import { getFrontVideos } from '../../../apis/frontApi';

// Helper function to get the correct embed URL for different video platforms
const getVideoEmbedSrc = (videoUrl, autoplay = 0, loop = 0) => {
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
        embedUrl = `https://www.youtube.com/embed/${videoId}?autoplay=${autoplay}&rel=0&loop=${loop}${loop ? `&playlist=${videoId}` : ''}`;
      }
    } else if (url.hostname.includes('bilibili.com')) {
      const videoId = url.pathname.split('/').find(part => part.startsWith('BV'));
      if (videoId) {
        embedUrl = `//player.bilibili.com/player.html?bvid=${videoId}&page=1&autoplay=${autoplay}&high_quality=1&danmaku=0&loop=${loop}`;
      }
    }
  } catch (e) {
    console.error("Error parsing video URL:", videoUrl, e);
    return '';
  }
  console.log("Generated embed URL:", embedUrl); // Add this line for debugging
  return embedUrl;
};

/**
 * 一个专门用于展示视频资料的组件。
 *
 * @param {Array} videos - 包含视频信息的数组。
 */
// export default function VideoShowcase({ videos }) 
export default function VideoShowcase() 
{
  const [videos, setVideos] = useState([]);
  const [selectedVideo, setSelectedVideo] = useState(null); // New state for selected video

  useEffect(() => {
    const fetchVideos = async () => {
      try {
        const response = await getFrontVideos();
        const fetchedVideos = response || [];
        setVideos(fetchedVideos);
        if (fetchedVideos.length > 0) {
          setSelectedVideo(fetchedVideos[0]); // Set the first video as selected by default
        }
      } catch (error) {
        console.error("Failed to fetch videos:", error);
        setVideos([]);
      }
    };
    fetchVideos();
  }, []);


  if (!videos || videos.length === 0) {
    return null;
  }

  return (
    <section className="video-showcase-container" aria-label="外部视频展示" 
    style={{ padding: '20px', backgroundColor: '#333', color: 'white' }}>
      {/* Top Section: Header and Description */}
      <div className="video-section-header" style={{ marginBottom: '20px', textAlign: 'center' }}>
        <p className="detail-kicker">影像资料</p>      
        <h3 style={{ color: 'white', fontSize: '2em', marginBottom: '10px' }}>航行与任务场景视频</h3>             
        <p className="video-section-copy" style={{ maxWidth: '800px', margin: '0 auto' }}>
          通过航行、靠泊、任务执行与细节镜头，辅助客户理解船型在真实使用场景中的状态与质感。
        </p>
      </div>

      {/* Horizontal Line */}
      <div style={{ borderBottom: '1px solid #555', margin: '20px 0' }}></div>

      {/* Main Content: Left Panel (List) and Right Panel (Player) */}
      <div style={{ display: 'flex', gap: '20px' }}>
        {/* Left Panel: Video List */}
        <div className="video-list-panel" 
        style={{ flex: '0 0 300px', overflowY: 'auto', maxHeight: '80vh', borderRight: '1px solid #555' }}>
          <h3 style={{ color: 'white', marginBottom: '15px' }}>视频列表</h3>
          <ul style={{ listStyle: 'none', padding: 0 }}>
            {videos.map((video) => (
              <li
                key={video.id}
                onClick={() => setSelectedVideo(video)}
                style={{
                  padding: '10px',
                  cursor: 'pointer',
                  backgroundColor: selectedVideo?.id === video.id ? '#555' : 'transparent',
                  borderRadius: '5px',
                  marginBottom: '5px',
                  transition: 'background-color 0.3s ease',
                }}
              >
                <a href="#" onClick={(e) => e.preventDefault()} style={{ color: 'white', textDecoration: 'none' }}>
                  {video.title}
                </a>
              </li>
            ))}
          </ul>
        </div>

        {/* Right Panel: Video Player */}
        <div className="video-player-panel" style={{ flex: '1' }}>
          {selectedVideo ? (
            <div className="video-frame-shell" 
            style={{ position: 'relative', width: '100%', paddingBottom: '56.25%', backgroundColor: '#000' }}>
              <iframe
                className="video-frame"
                src={getVideoEmbedSrc(selectedVideo.url, 1, 1)} // Autoplay and loop the selected video
                title={selectedVideo.title}
                allow="autoplay; fullscreen;"
                style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', border: 'none' }}
              />
            </div>
          ) : (
            <div style={{ textAlign: 'center', padding: '50px', border: '1px dashed #555', borderRadius: '5px' }}>
              <p>请从左侧列表中选择一个视频播放。</p>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}