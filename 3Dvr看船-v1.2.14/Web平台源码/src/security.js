const crypto = require('crypto');
const { promisify } = require('util');

const scrypt = promisify(crypto.scrypt);

function hashPassword(password, salt) {
  return crypto.scryptSync(password, salt, 64).toString('hex');
}

// 登录/改密热路径使用异步 scrypt，避免同步 scryptSync 阻塞事件循环。
async function verifyPassword(password, salt, expectedHash) {
  if (!salt || !expectedHash) return false;
  const actual = await scrypt(password, salt, 64);
  const actualHex = Buffer.from(actual).toString('hex');
  if (actualHex.length !== expectedHash.length) return false;
  return crypto.timingSafeEqual(Buffer.from(actualHex, 'hex'), Buffer.from(expectedHash, 'hex'));
}

function validatePassword(password) {
  if (typeof password !== 'string' || password.length < 6 || password.length > 18) return false;
  const types = [/[0-9]/.test(password), /[a-zA-Z]/.test(password), /[^0-9a-zA-Z]/.test(password)];
  return types.filter(Boolean).length >= 2;
}

function makePassword(password) {
  const salt = crypto.randomBytes(16).toString('hex');
  return { salt, passwordHash: hashPassword(password, salt) };
}

function makeToken() {
  return crypto.randomBytes(32).toString('base64url');
}

function hashToken(token) {
  return crypto.createHash('sha256').update(token).digest('hex');
}

function hashAnswer(answer) {
  return crypto.createHash('sha256').update(String(answer).trim().toLowerCase()).digest('hex');
}

module.exports = { hashPassword, verifyPassword, validatePassword, makePassword, makeToken, hashToken, hashAnswer };
