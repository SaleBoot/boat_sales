/* ===== 登录 / 注册 / 找回密码 交互逻辑 ===== */

const API_BASE = '';
let currentCaptcha = '';

document.addEventListener('DOMContentLoaded', async () => {
  // 已登录则直接跳首页（先用接口验证 session 有效性，避免 localStorage 残留导致重定向循环）
  const session = getSession();
  if (session && session.username) {
    try {
      const res = await fetch(`${API_BASE}/api/auth/me`, { credentials: 'same-origin' });
      if (res.ok) {
        const json = await res.json();
        if (json.success && json.data) {
          window.location.href = roleHome(json.data.role || session.role);
          return;
        }
      }
    } catch (e) { /* 验证失败则继续显示登录页 */ }
    // session 已失效，清除 localStorage 残留
    localStorage.removeItem('auth_user');
  }

  initCaptcha();
  initTabs();
  initPasswordToggles();
  initForms();
  loadSecurityQuestions();
});

/* ---------- 验证码（图形） ---------- */
function initCaptcha() {
  const canvas = document.getElementById('captchaCanvas');
  if (canvas) {
    canvas.addEventListener('click', () => drawCaptcha(canvas));
    drawCaptcha(canvas);
  }
}

function drawCaptcha(canvas) {
  const ctx = canvas.getContext('2d');
  const w = canvas.width, h = canvas.height;
  // 背景色
  const bg = ['#D8B4E2', '#B4D8E2', '#D8E2B4', '#E2B4D8'][Math.floor(Math.random() * 4)];
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, w, h);
  // 干扰线
  for (let i = 0; i < 4; i++) {
    ctx.strokeStyle = `rgba(${rand(60, 180)},${rand(60, 180)},${rand(60, 180)},0.45)`;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(rand(0, w), rand(0, h));
    ctx.lineTo(rand(0, w), rand(0, h));
    ctx.stroke();
  }
  // 字符
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = '';
  const colors = ['#1a1a1a', '#2D5BA8', '#6B4EE6', '#E63946'];
  const fonts = ['Georgia', 'Courier New', 'Verdana', 'Arial'];
  for (let i = 0; i < 4; i++) {
    const c = chars[rand(0, chars.length - 1)];
    code += c;
    ctx.save();
    ctx.font = `bold ${rand(24, 30)}px ${fonts[rand(0, fonts.length - 1)]}`;
    ctx.fillStyle = colors[rand(0, colors.length - 1)];
    ctx.translate(22 + i * 24, h / 2);
    ctx.rotate((rand(-30, 30) * Math.PI) / 180);
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(c, 0, 0);
    ctx.restore();
  }
  // 噪点
  for (let i = 0; i < 30; i++) {
    ctx.fillStyle = `rgba(${rand(40, 200)},${rand(40, 200)},${rand(40, 200)},0.3)`;
    ctx.fillRect(rand(0, w), rand(0, h), 2, 2);
  }
  currentCaptcha = code;
}

function rand(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

/* ---------- Tab 切换 ---------- */
function initTabs() {
  const tabs = document.querySelectorAll('.auth-tab');
  const panels = document.querySelectorAll('.auth-form');
  tabs.forEach(tab => {
    tab.addEventListener('click', () => {
      const name = tab.dataset.tab;
      tabs.forEach(t => t.classList.toggle('active', t === tab));
      panels.forEach(p => p.classList.toggle('active', p.dataset.panel === name));
      clearHints();
    });
  });
}

function clearHints() {
  document.querySelectorAll('.field-hint:not(.static)').forEach(h => { h.textContent = ''; h.classList.remove('success'); });
}

/* ---------- 密码显隐切换 ---------- */
function initPasswordToggles() {
  [['loginPwdToggle', 'loginPassword'],
   ['regPwdToggle', 'regPassword'],
   ['fpPwdToggle', 'fpNewPassword']].forEach(([btnId, inputId]) => {
    const btn = document.getElementById(btnId);
    const input = document.getElementById(inputId);
    if (!btn || !input) return;
    btn.addEventListener('click', () => {
      const isPwd = input.type === 'password';
      input.type = isPwd ? 'text' : 'password';
      btn.classList.toggle('show', isPwd);
      btn.setAttribute('aria-label', isPwd ? '隐藏密码' : '显示密码');
    });
  });
}

/* ---------- 表单提交 ---------- */
function initForms() {
  document.getElementById('loginForm').addEventListener('submit', handleLogin);
  document.getElementById('registerForm').addEventListener('submit', handleRegister);
  document.getElementById('forgotForm').addEventListener('submit', handleResetPassword);
  document.getElementById('fpGetQuestion').addEventListener('click', fetchSecurityQuestion);
  document.getElementById('codeLoginBtn').addEventListener('click', toggleCodeLogin);

  // 回车键在验证码框提交
  document.getElementById('loginCaptcha').addEventListener('keydown', e => {
    if (e.key === 'Enter') document.getElementById('loginForm').requestSubmit();
  });
}

/* ---------- 账号登录 ---------- */
async function handleLogin(e) {
  e.preventDefault();
  const hint = document.getElementById('loginHint');
  const username = document.getElementById('loginUsername').value.trim();
  const password = document.getElementById('loginPassword').value;

  // 验证码登录模式
  if (codeLoginMode) return handleCodeLogin(username);

  const captchaInput = document.getElementById('loginCaptcha').value.trim();
  if (!username || !password) {
    return setHint(hint, '请输入用户名和密码');
  }
  if (captchaInput.toLowerCase() !== currentCaptcha.toLowerCase()) {
    drawCaptcha(document.getElementById('captchaCanvas'));
    document.getElementById('loginCaptcha').value = '';
    return setHint(hint, '验证码错误，请重新输入');
  }

  setBtnLoading('loginForm', true);
  try {
    const res = await fetch(`${API_BASE}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password })
    });
    const json = await res.json();
    if (json.success) {
      saveSession(json.data);
      showToast('登录成功，欢迎回来！', 'success');
      const target = roleHome(json.data.role);
      setTimeout(() => { window.location.href = target; }, 600);
    } else {
      drawCaptcha(document.getElementById('captchaCanvas'));
      document.getElementById('loginCaptcha').value = '';
      setHint(hint, json.message || '用户名或密码错误');
    }
  } catch (err) {
    setHint(hint, '网络异常，请稍后重试');
  } finally {
    setBtnLoading('loginForm', false);
  }
}

/* ---------- 验证码登录（演示：本地生成 6 位短信码） ---------- */
let codeLoginMode = false;
let sentCode = '';

function toggleCodeLogin() {
  codeLoginMode = !codeLoginMode;
  const form = document.getElementById('loginForm');
  const captchaField = form.querySelector('.field-captcha');
  const usernameInput = document.getElementById('loginUsername');
  const passwordInput = document.getElementById('loginPassword');
  const codeBtn = document.getElementById('codeLoginBtn');
  const hint = document.getElementById('loginHint');
  hint.textContent = '';

  if (codeLoginMode) {
    captchaField.style.display = 'none';
    usernameInput.placeholder = '请输入手机号';
    usernameInput.value = '';
    passwordInput.value = '';
    passwordInput.type = 'text';
    passwordInput.placeholder = '请输入 6 位短信验证码';
    codeBtn.textContent = '账号登录';
    codeBtn.insertAdjacentHTML('afterend', '<button type="button" class="auth-secondary" id="sendCodeBtn" style="margin-top:8px;">获取验证码</button>');
    document.getElementById('sendCodeBtn').addEventListener('click', sendSmsCode);
    showToast('演示模式：验证码将显示在屏幕提示中', '');
  } else {
    const sendBtn = document.getElementById('sendCodeBtn');
    if (sendBtn) sendBtn.remove();
    captchaField.style.display = '';
    usernameInput.placeholder = '请输入用户名';
    usernameInput.value = '';
    passwordInput.type = 'password';
    passwordInput.placeholder = '请输入密码';
    codeBtn.textContent = '验证码登录';
    drawCaptcha(document.getElementById('captchaCanvas'));
  }
}

function sendSmsCode() {
  const phone = document.getElementById('loginUsername').value.trim();
  if (!/^1[3-9]\d{9}$/.test(phone)) {
    return showToast('请输入有效的手机号', 'error');
  }
  sentCode = String(rand(100000, 999999));
  // 演示环境：直接展示验证码（真实环境应通过短信下发）
  showToast(`演示验证码：${sentCode}（真实环境将短信发送至 ${phone}）`, '');
  startCountdown();
}

let countdownTimer = null;
function startCountdown() {
  let sec = 60;
  const btn = document.getElementById('sendCodeBtn');
  if (!btn) return;
  btn.disabled = true;
  btn.textContent = `${sec}s 后重发`;
  countdownTimer = setInterval(() => {
    sec--;
    btn.textContent = `${sec}s 后重发`;
    if (sec <= 0) {
      clearInterval(countdownTimer);
      btn.disabled = false;
      btn.textContent = '获取验证码';
    }
  }, 1000);
}

function handleCodeLogin(phone) {
  const hint = document.getElementById('loginHint');
  const code = document.getElementById('loginPassword').value.trim();
  if (!phone) return setHint(hint, '请输入手机号');
  if (!sentCode) return setHint(hint, '请先获取验证码');
  if (code !== sentCode) return setHint(hint, '验证码错误');
  // 演示登录成功
  saveSession({ id: Date.now(), username: phone, role: 'user' });
  showToast('验证码登录成功', 'success');
  setTimeout(() => { window.location.href = 'index.html'; }, 600);
}

/* ---------- 注册 ---------- */
async function loadSecurityQuestions() {
  try {
    const res = await fetch(`${API_BASE}/api/auth/questions`);
    const json = await res.json();
    if (json.success) {
      const sel = document.getElementById('regQuestion');
      json.data.forEach(q => {
        const opt = document.createElement('option');
        opt.value = q; opt.textContent = q;
        sel.appendChild(opt);
      });
    }
  } catch (err) { console.error('加载密保问题失败', err); }
}

async function handleRegister(e) {
  e.preventDefault();
  const hint = document.getElementById('regHint');
  const username = document.getElementById('regUsername').value.trim();
  const password = document.getElementById('regPassword').value;
  const password2 = document.getElementById('regPassword2').value;
  const securityQuestion = document.getElementById('regQuestion').value;
  const securityAnswer = document.getElementById('regAnswer').value.trim();

  if (!username) return setHint(hint, '请设置用户名');
  if (!password) return setHint(hint, '请设置密码');
  if (!validatePasswordFormat(password)) return setHint(hint, '密码格式应为6-18位数字、字母、符号的任意两种组合');
  if (password !== password2) return setHint(hint, '两次输入的密码不一致');
  if (!securityQuestion) return setHint(hint, '请选择密保问题');
  if (!securityAnswer) return setHint(hint, '请填写密保答案');

  setBtnLoading('registerForm', true);
  try {
    const res = await fetch(`${API_BASE}/api/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password, securityQuestion, securityAnswer })
    });
    const json = await res.json();
    if (json.success) {
      showToast('注册成功，请登录', 'success');
      document.getElementById('registerForm').reset();
      switchToTab('login');
      document.getElementById('loginUsername').value = username;
    } else {
      setHint(hint, json.message || '注册失败');
    }
  } catch (err) {
    setHint(hint, '网络异常，请稍后重试');
  } finally {
    setBtnLoading('registerForm', false);
  }
}

function validatePasswordFormat(pw) {
  if (pw.length < 6 || pw.length > 18) return false;
  const types = [/[0-9]/.test(pw), /[a-zA-Z]/.test(pw), /[^0-9a-zA-Z]/.test(pw)];
  return types.filter(Boolean).length >= 2;
}

/* ---------- 找回密码 ---------- */
async function fetchSecurityQuestion() {
  const hint = document.getElementById('fpHint');
  const username = document.getElementById('fpUsername').value.trim();
  const qInput = document.getElementById('fpQuestion');
  if (!username) return setHint(hint, '请输入用户名');

  const btn = document.getElementById('fpGetQuestion');
  btn.disabled = true;
  btn.textContent = '查询中...';
  try {
    const res = await fetch(`${API_BASE}/api/auth/security-question`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username })
    });
    const json = await res.json();
    if (json.success) {
      qInput.value = json.data.securityQuestion;
      setHint(hint, '请回答密保问题以重置密码', 'success');
    } else {
      qInput.value = '';
      setHint(hint, json.message || '未找到该用户');
    }
  } catch (err) {
    setHint(hint, '网络异常，请稍后重试');
  } finally {
    btn.disabled = false;
    btn.textContent = '获取密保';
  }
}

async function handleResetPassword(e) {
  e.preventDefault();
  const hint = document.getElementById('fpHint');
  const username = document.getElementById('fpUsername').value.trim();
  const securityAnswer = document.getElementById('fpAnswer').value.trim();
  const newPassword = document.getElementById('fpNewPassword').value;
  const newPassword2 = document.getElementById('fpNewPassword2').value;

  if (!username) return setHint(hint, '请输入用户名');
  if (!securityAnswer) return setHint(hint, '请填写密保答案');
  if (!validatePasswordFormat(newPassword)) return setHint(hint, '密码格式应为6-18位数字、字母、符号的任意两种组合');
  if (newPassword !== newPassword2) return setHint(hint, '两次输入的密码不一致');

  setBtnLoading('forgotForm', true);
  try {
    const res = await fetch(`${API_BASE}/api/auth/reset-password`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, securityAnswer, newPassword })
    });
    const json = await res.json();
    if (json.success) {
      showToast('密码重置成功，请使用新密码登录', 'success');
      document.getElementById('forgotForm').reset();
      switchToTab('login');
      document.getElementById('loginUsername').value = username;
    } else {
      setHint(hint, json.message || '重置失败');
    }
  } catch (err) {
    setHint(hint, '网络异常，请稍后重试');
  } finally {
    setBtnLoading('forgotForm', false);
  }
}

/* ---------- 工具函数 ---------- */
function switchToTab(name) {
  document.querySelectorAll('.auth-tab').forEach(t => t.classList.toggle('active', t.dataset.tab === name));
  document.querySelectorAll('.auth-form').forEach(p => p.classList.toggle('active', p.dataset.panel === name));
  clearHints();
}

function setHint(el, msg, type = '') {
  if (!el) return;
  el.textContent = msg || '';
  el.classList.remove('success');
  if (type === 'success') el.classList.add('success');
}

function setBtnLoading(formId, loading) {
  const form = document.getElementById(formId);
  if (!form) return;
  const btn = form.querySelector('.auth-submit');
  if (!btn) return;
  if (loading) {
    btn.dataset.text = btn.textContent;
    btn.textContent = '处理中...';
    btn.disabled = true;
  } else {
    btn.textContent = btn.dataset.text || btn.textContent;
    btn.disabled = false;
  }
}

function showToast(message, type = '') {
  const container = document.getElementById('toastContainer');
  if (!container) return;
  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  toast.textContent = message;
  container.appendChild(toast);
  setTimeout(() => {
    toast.style.animation = 'toastIn 0.3s reverse';
    setTimeout(() => toast.remove(), 300);
  }, 3500);
}

/* ---------- 会话管理 ---------- */
function saveSession(user) {
  localStorage.setItem('auth_user', JSON.stringify(user));
}
function getSession() {
  try { return JSON.parse(localStorage.getItem('auth_user')); } catch { return null; }
}

function roleHome(role) {
  if (role === 'admin' || role === 'platform_admin') return 'members.html';
  if (role === 'shipyard_owner' || role === 'sales') return 'shipyard.html';
  return 'index.html';
}
