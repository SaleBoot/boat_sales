/* 会话实时监测：右上角用户区 + 全局。
 * 定时 /api/auth/me 探活；若会话失效/被顶掉，自动清状态并退出登录。
 */
(function () {
  var KEY = 'auth_user';
  var POLL_MS = 20000;
  function getUser() { try { return JSON.parse(localStorage.getItem(KEY)); } catch (e) { return null; } }
  function logout() {
    localStorage.removeItem(KEY);
    try {
      var t = document.querySelector('#toastContainer, #toastBox, .toast-container');
      if (t) {
        var el = document.createElement('div');
        el.className = 'toast error';
        el.textContent = '登录状态已失效，请重新登录';
        t.appendChild(el);
        setTimeout(function () { el.remove(); }, 2500);
      }
    } catch (e) {}
    setTimeout(function () { window.location.href = '/login.html'; }, 500);
  }
  async function check() {
    try {
      var res = await fetch('/api/auth/me', { credentials: 'same-origin' });
      if (!res.ok) { logout(); return; }
      var j = await res.json();
      if (!j || !j.success) { logout(); return; }
      localStorage.setItem(KEY, JSON.stringify(j.data));
      window.__authValid = j.data;
    } catch (e) { /* 网络波动不处理 */ }
  }
  // 仅当本地有已登录状态才轮询
  if (!getUser()) return;
  check();
  setInterval(check, POLL_MS);
  // 顶层导航前也探一次，避免带失效会话进入受保护页
  try {
    var op = document.addEventListener ? 'addEventListener' : 'attachEvent';
    var ev = document.addEventListener ? 'beforeunload' : 'onbeforeunload';
    if (document.addEventListener) document.addEventListener('beforeunload', function () { check(); });
  } catch (e) {}
})();
