const express = require('express');
const app = express();
app.use(express.json({ limit: '32kb' }));
require('./vr-screen')(app, async (req, res, next) => {
  try {
    const response = await fetch(new URL('/api/auth/me', process.env.SHIP_API_ORIGIN), {
      headers: { cookie: req.headers.cookie || '', authorization: req.headers.authorization || '' },
      signal: AbortSignal.timeout(5000), redirect: 'error'
    });
    if (!response.ok) return res.sendStatus(response.status === 401 || response.status === 403 ? response.status : 503);
    const { data: user } = await response.json();
    if (!user?.id || !(user.role === 'platform_admin' || (['shipyard_owner', 'sales'].includes(user.role) && user.shipyardId))) return res.sendStatus(403);
    req.platformUser = user;
    next();
  } catch { res.sendStatus(503); }
});
module.exports = app;
if (require.main === module) app.listen(Number(process.env.PORT || 3001), '127.0.0.1');
