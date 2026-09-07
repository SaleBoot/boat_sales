const crypto = require('crypto');

// 轻量内存限流：按客户端 IP 固定窗口计数，单进程即可覆盖当前部署规模。
// 窗口过期条目会被惰性清理，避免内存无限增长。
function rateLimit({ windowMs = 60 * 1000, max = 60, message = '请求过于频繁，请稍后再试' } = {}) {
  const buckets = new Map();
  const maxEntries = 100000;

  function clientKey(req) {
    const forwarded = String(req.headers['x-real-ip'] || req.headers['x-forwarded-for'] || '').split(',')[0].trim();
    const ip = forwarded || req.ip || req.socket.remoteAddress || 'unknown';
    return crypto.createHash('sha256').update(ip).digest('hex').slice(0, 16);
  }

  return (req, res, next) => {
    const now = Date.now();
    const key = clientKey(req);
    let bucket = buckets.get(key);
    if (!bucket || bucket.resetAt <= now) {
      bucket = { count: 0, resetAt: now + windowMs };
      buckets.set(key, bucket);
    }
    bucket.count += 1;

    if (buckets.size > maxEntries) {
      for (const [entryKey, entry] of buckets) {
        if (entry.resetAt <= now) buckets.delete(entryKey);
        if (buckets.size <= maxEntries) break;
      }
    }

    res.setHeader('X-RateLimit-Limit', String(max));
    res.setHeader('X-RateLimit-Remaining', String(Math.max(0, max - bucket.count)));

    if (bucket.count > max) {
      return res.status(429).json({ success: false, message });
    }
    next();
  };
}

module.exports = { rateLimit };
