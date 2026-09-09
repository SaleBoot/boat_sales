const express = require('express');

module.exports = function installVrScreen(app, requireVrUser) {
  // ponytail: one Node process and at most 100 active accounts; use a media relay for larger deployments.
  const screens = new Map();
  const leaseMs = 10000;
  const getScreen = id => {
    let screen = screens.get(id);
    if (!screen) {
      if (screens.size >= 100) return null;
      screen = { until: 0, seen: 0, received: 0, frame: null };
      screens.set(id, screen);
    }
    return screen;
  };
  const timer = setInterval(() => {
    for (const [id, screen] of screens) if (Math.max(screen.until, (screen.seen || 0) + leaseMs) < Date.now()) screens.delete(id);
  }, leaseMs);
  timer.unref();
  app.get('/api/vr/screen/status', requireVrUser, (req, res) => {
    if (String(req.headers.authorization || '').startsWith('Bearer ')) {
      const screen = getScreen(req.platformUser.id);
      if (!screen) return res.sendStatus(503);
      screen.seen = Date.now();
      screen.version = String(req.query.version || '').slice(0, 24);
      screen.stage = ['ready','connecting','streaming','reconnecting','disconnected','error','no_capture'].includes(req.query.stage) ? req.query.stage : 'ready';
    }
    res.set('Cache-Control', 'no-store').json({ active: (screens.get(req.platformUser.id)?.until || 0) > Date.now() });
  });
  app.post('/api/vr/screen/watch', requireVrUser, (req, res) => {
    const screen = getScreen(req.platformUser.id);
    if (!screen) return res.sendStatus(503);
    screen.until = Date.now() + leaseMs;
    res.set('Cache-Control', 'no-store').json({ online: Date.now() - screen.seen < leaseMs,
      version: screen.version || '', stage: screen.stage || 'offline' });
  });
  app.post('/api/vr/screen/connect', requireVrUser, async (req, res, next) => {
    try {
      const role = req.body?.role;
      if (!['viewer', 'publisher'].includes(role)) return res.sendStatus(400);
      if (role === 'publisher' && !String(req.headers.authorization || '').startsWith('Bearer ')) return res.sendStatus(403);
      const key = process.env.LIVEKIT_API_KEY, secret = process.env.LIVEKIT_API_SECRET;
      if (!key || !secret || !process.env.SHIPVR_LIVEKIT_URL) return res.status(503).json({ message: '视频服务尚未配置' });
      if (role === 'publisher' && (screens.get(req.platformUser.id)?.until || 0) < Date.now()) return res.sendStatus(409);
      const { AccessToken } = require('livekit-server-sdk');
      const room = 'shipvr-user-' + req.platformUser.id;
      const token = new AccessToken(key, secret, { identity: role === 'publisher' ? 'headset' : 'viewer-' + require('crypto').randomUUID(), ttl: '15m' });
      token.addGrant({ roomJoin: true, room, canPublish: role === 'publisher', canSubscribe: role === 'viewer', canPublishData: false });
      res.set('Cache-Control', 'no-store').json({ url: process.env.SHIPVR_LIVEKIT_URL, token: await token.toJwt() });
    } catch (error) { next(error); }
  });
  app.get('/api/vr/screen/frame', requireVrUser, (req, res) => {
    res.set('Cache-Control', 'no-store');
    const id = req.platformUser.id;
    let screen = screens.get(id);
    if (!screen || screen.until < Date.now()) {
      if (!screen && screens.size >= 100) return res.sendStatus(503);
      screen = { until: 0, frame: null, received: 0 };
      screens.set(id, screen);
    }
    screen.until = Date.now() + leaseMs;
    if (!screen.frame || Date.now() - screen.received > 5000) return res.sendStatus(204);
    res.type('image/jpeg').send(screen.frame);
  });
  app.post('/api/vr/screen/frame', requireVrUser, express.raw({ type: 'image/jpeg', limit: '200kb' }), (req, res) => {
    res.set('Cache-Control', 'no-store');
    const screen = screens.get(req.platformUser.id);
    if (!screen || screen.until < Date.now()) return res.sendStatus(409);
    const frame = req.body;
    if (!Buffer.isBuffer(frame) || frame.length < 4 || frame[0] !== 255 || frame[1] !== 216 || frame.at(-2) !== 255 || frame.at(-1) !== 217) return res.sendStatus(400);
    if (Date.now() - screen.received < 100) return res.sendStatus(429);
    screen.frame = frame;
    screen.received = Date.now();
    res.sendStatus(204);
  });
};
