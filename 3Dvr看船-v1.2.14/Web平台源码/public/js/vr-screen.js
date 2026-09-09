'use strict';
const video = document.getElementById('frame');
const waiting = document.getElementById('waiting');
const status = document.getElementById('status');
let room, stopped = false, connecting = false, lastTime = -1, lastFrameAt = 0, connectedAt = 0, timer;
document.getElementById('fit').onclick = event => {
  const screen = document.getElementById('screen');
  const fit = screen.dataset.fit === 'contain' ? 'cover' : 'contain';
  screen.dataset.fit = fit;
  event.currentTarget.textContent = fit === 'contain' ? '铺满画面' : '完整画面';
};
document.getElementById('play').onclick = async event => {
  try { await video.play(); event.currentTarget.hidden = true; } catch { message('浏览器暂时无法播放视频，请刷新页面'); }
};
document.getElementById('back').onclick = () => history.length > 1 ? history.back() : location.assign('/');
document.getElementById('fullscreen').onclick = async () => {
  try { if (document.fullscreenElement) await document.exitFullscreen(); else await document.getElementById('screen').requestFullscreen(); }
  catch { status.textContent = '当前浏览器无法进入全屏'; }
};
function message(text) { status.textContent = text; video.hidden = true; waiting.hidden = false; waiting.textContent = text; }
async function request(path, body = {}) {
  const response = await fetch('/api/vr/screen/' + path, { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify(body), signal:AbortSignal.timeout(path === 'watch' ? 4000 : 8000) });
  if (response.status === 401 || response.status === 403) {
    stopped = true; disconnect(); message('请使用与头显相同的厂商或销售账号登录'); throw new Error('auth');
  }
  if (!response.ok) throw new Error('视频服务暂不可用');
  return response.json();
}
function disconnect() {
  const previous = room;
  room = null; connectedAt = 0; lastFrameAt = 0; lastTime = -1;
  video.srcObject = null;
  if (previous) { previous.removeAllListeners(); void previous.disconnect(); }
}
async function connect() {
  if (connecting || stopped) return;
  connecting = true;
  let current;
  try {
    const credentials = await request('connect', {role:'viewer'});
    if (stopped) return;
    // The waiting screen hides the video: adaptive visibility would prevent its first frame.
    current = new LivekitClient.Room({adaptiveStream:false});
    room = current;
    current.on(LivekitClient.RoomEvent.TrackSubscribed, (track, publication, participant) => {
      if (room !== current || stopped || participant.identity !== 'headset' || track.kind !== 'video') return;
      track.attach(video); lastFrameAt = 0; lastTime = -1; connectedAt = Date.now();
      video.play().catch(() => { if (room !== current || stopped) return; document.getElementById('play').hidden = false; message('请点击“播放画面”'); });
    });
    current.on(LivekitClient.RoomEvent.TrackUnsubscribed, track => { if (room !== current || stopped || track.kind !== 'video') return; track.detach(video); video.srcObject = null; lastFrameAt = 0; message('头显视频已断开，等待恢复…'); });
    current.on(LivekitClient.RoomEvent.Reconnecting, () => { if (room === current && !stopped) message('视频连接中断，正在重连…'); });
    current.on(LivekitClient.RoomEvent.Disconnected, () => { if (room !== current || stopped) return; disconnect(); message('视频连接中断，正在重连…'); });
    await current.connect(credentials.url, credentials.token, {websocketTimeout:8000, peerConnectionTimeout:10000, maxRetries:0});
    if (stopped || room !== current) await current.disconnect();
    else connectedAt = Date.now();
  } catch (error) {
    if (room === current) disconnect();
    if (!stopped) message('视频连接失败，正在重试…');
  } finally { connecting = false; }
}
async function tick() {
  if (stopped) return;
  try {
    const state = await request('watch');
    // Renew the sender lease even while RTC connection is pending.
    if (!room) void connect();
    if (!stopped) {
      if (video.srcObject && video.currentTime !== lastTime && video.readyState >= 2) { lastTime = video.currentTime; lastFrameAt = Date.now(); }
      if (lastFrameAt && Date.now() - lastFrameAt < 6000 && video.readyState >= 2) {
        if (!video.paused) document.getElementById('play').hidden = true;
        video.hidden = false; waiting.hidden = true; status.textContent = '正在直播 VR 视角';
      } else if (room && !connecting && connectedAt && Date.now() - (lastFrameAt || connectedAt) > 15000 && document.getElementById('play').hidden) {
        disconnect(); void connect(); message('视频长时间未到达，正在重新连接…');
      } else if (!state.online) message('未检测到头显发送端，请安装 1.2.17 或更新版本，并使用相同账号登录');
      else if (state.stage === 'no_capture') message('头显已连接，等待 VR 应用恢复前台画面');
      else if (state.stage === 'error') message('头显视频连接失败，正在自动重试');
      else message('已检测到头显 ' + state.version + '，正在连接视频…');
    }
  } catch { if (!stopped) message('服务连接中断，正在重试…'); }
  if (!stopped) timer = setTimeout(tick, 2000);
}
window.addEventListener('pagehide', () => { stopped = true; clearTimeout(timer); disconnect(); });
window.addEventListener('pageshow', event => { if (event.persisted) { location.reload(); } });
tick();
