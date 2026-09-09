/* 会话实时监测：右上角用户区 + 全局。
 * 定时 /api/auth/me 探活；若会话失效/被顶掉，自动清状态并退出登录。
 */
(function () {
  var KEY = 'auth_user';
  var POLL_MS = 20000;
  var running = false, stopped = false, delay = POLL_MS, timer;
  function getUser() { try { return JSON.parse(localStorage.getItem(KEY)); } catch (e) { return null; } }
  function logout() {
    stopped = true;
    clearTimeout(timer);
    localStorage.removeItem(KEY);
    try {
      var t = document.querySelector('#toastContainer, #toastBox, .toast-container');
      if (t) {
        var el = document.createElement('div');
        el.className = 'toast error';
        el.textContent = '登录已失效或账号已在另一台电脑登录，请重新登录';
        t.appendChild(el);
        setTimeout(function () { el.remove(); }, 2500);
      }
    } catch (e) {}
    setTimeout(function () { window.location.href = '/login.html'; }, 500);
  }
  async function check() {
    if (running || stopped) return;
    clearTimeout(timer);
    running = true;
    try {
      var res = await fetch('/api/auth/me', { credentials: 'same-origin', cache: 'no-store', signal: AbortSignal.timeout(10000) });
      if (res.status === 401) { logout(); return; }
      if (!res.ok) throw new Error('Session check unavailable');
      var j = await res.json();
      if (!j || !j.success || !j.data) throw new Error('Invalid session response');
      delay = POLL_MS;
      localStorage.setItem(KEY, JSON.stringify(j.data));
      window.__authValid = j.data;
    } catch (e) { delay = Math.min(delay * 2, 120000); }
    finally { running = false; if (!stopped) timer = setTimeout(check, delay); }
  }
  // 仅当本地有已登录状态才轮询
  if (!getUser()) return;
  // The containing management page already checks the same cookie session.
  try { if (window !== window.top && window.top.__shipSessionWatch) return; } catch (e) {}
  window.__shipSessionWatch = true;
  if (window === window.top && ['admin', 'platform_admin'].includes(getUser().role)) {
    var progress = document.createElement('script');
    progress.src = '/js/model-build-progress.js'; document.head.appendChild(progress);
  }
  check();
  window.addEventListener('online', check);
  document.addEventListener('visibilitychange', function () { if (!document.hidden) check(); });
})();
