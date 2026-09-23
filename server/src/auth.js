import fs from 'node:fs/promises'
import path from 'node:path'
import crypto from 'node:crypto'

const dataDir = path.resolve(process.env.FIGDOC_DATA_DIR || '.')
const authPath = path.join(dataDir, 'figdoc-auth.json')
const SESSION_TTL_MS = 1000 * 60 * 60 * 24 * 30
const googleStates = new Set()

async function readAuth() {
  try {
    const data = JSON.parse(await fs.readFile(authPath, 'utf8'))
    return { users: Array.isArray(data.users) ? data.users : [], sessions: Array.isArray(data.sessions) ? data.sessions : [] }
  } catch (error) {
    if (error.code === 'ENOENT') return { users: [], sessions: [] }
    throw error
  }
}

async function writeAuth(data) {
  await fs.mkdir(path.dirname(authPath), { recursive: true })
  const temporaryPath = `${authPath}.tmp`
  await fs.writeFile(temporaryPath, JSON.stringify(data), 'utf8')
  await fs.rename(temporaryPath, authPath)
}

async function createSession(userId) {
  const data = await readAuth()
  const token = crypto.randomBytes(32).toString('hex')
  data.sessions = data.sessions.filter(session => session.expiresAt > Date.now())
  data.sessions.push({ token, userId, expiresAt: Date.now() + SESSION_TTL_MS })
  await writeAuth(data)
  return token
}

function normalizeEmail(email) {
  return typeof email === 'string' ? email.trim().toLowerCase() : ''
}

function publicUser(user) {
  return { id: user.id, email: user.email, guest: Boolean(user.guest), createdAt: user.createdAt }
}

function tokenFromRequest(req) {
  if (req.headers.authorization?.startsWith('Bearer ')) return req.headers.authorization.slice(7)
  const cookie = req.headers.cookie?.split(';').map(value => value.trim()).find(value => value.startsWith('figdoc_session='))
  return cookie ? decodeURIComponent(cookie.slice('figdoc_session='.length)) : null
}

function hashPassword(password, salt = crypto.randomBytes(16).toString('hex')) {
  return new Promise((resolve, reject) => crypto.scrypt(password, salt, 64, (error, derivedKey) => error ? reject(error) : resolve(`${salt}:${derivedKey.toString('hex')}`)))
}

async function verifyPassword(password, stored) {
  const [salt, expected] = String(stored).split(':')
  if (!salt || !expected) return false
  const actual = await hashPassword(password, salt)
  return crypto.timingSafeEqual(Buffer.from(actual.split(':')[1], 'hex'), Buffer.from(expected, 'hex'))
}

export async function register(email, password) {
  const normalizedEmail = normalizeEmail(email)
  if (!/^\S+@\S+\.\S+$/.test(normalizedEmail)) throw Object.assign(new Error('Enter a valid email address.'), { status: 400 })
  if (typeof password !== 'string' || password.length < 8) throw Object.assign(new Error('Password must be at least 8 characters.'), { status: 400 })
  const data = await readAuth()
  if (data.users.some(user => user.email === normalizedEmail)) throw Object.assign(new Error('An account with that email already exists.'), { status: 409 })
  const user = { id: crypto.randomUUID(), email: normalizedEmail, passwordHash: await hashPassword(password), createdAt: new Date().toISOString() }
  data.users.push(user)
  await writeAuth(data)
  return publicUser(user)
}

export async function login(email, password) {
  const data = await readAuth()
  const user = data.users.find(item => item.email === normalizeEmail(email))
  if (!user || !(await verifyPassword(password, user.passwordHash))) throw Object.assign(new Error('Email or password is incorrect.'), { status: 401 })
  const token = await createSession(user.id)
  return { token, user: publicUser(user) }
}

export async function createGuestSession() {
  const data = await readAuth()
  const user = { id: `guest-${crypto.randomUUID()}`, email: 'guest@figdoc.local', guest: true, createdAt: new Date().toISOString() }
  data.users.push(user)
  await writeAuth(data)
  return { token: await createSession(user.id), user: publicUser(user) }
}

export function googleEnabled() {
  return Boolean(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET && process.env.GOOGLE_REDIRECT_URI)
}

export function googleAuthorizationUrl() {
  if (!googleEnabled()) throw Object.assign(new Error('Google sign-in is not configured.'), { status: 503 })
  const state = crypto.randomBytes(24).toString('hex')
  googleStates.add(state)
  const params = new URLSearchParams({ client_id: process.env.GOOGLE_CLIENT_ID, redirect_uri: process.env.GOOGLE_REDIRECT_URI, response_type: 'code', scope: 'openid email profile', state, access_type: 'online', prompt: 'select_account' })
  return `https://accounts.google.com/o/oauth2/v2/auth?${params}`
}

export async function completeGoogleLogin(code, state) {
  if (!googleEnabled() || typeof code !== 'string' || !googleStates.delete(state)) throw Object.assign(new Error('Invalid Google sign-in request.'), { status: 400 })
  const tokenResponse = await fetch('https://oauth2.googleapis.com/token', { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams({ code, client_id: process.env.GOOGLE_CLIENT_ID, client_secret: process.env.GOOGLE_CLIENT_SECRET, redirect_uri: process.env.GOOGLE_REDIRECT_URI, grant_type: 'authorization_code' }) })
  if (!tokenResponse.ok) throw Object.assign(new Error('Google sign-in could not be completed.'), { status: 401 })
  const tokens = await tokenResponse.json()
  const profileResponse = await fetch('https://openidconnect.googleapis.com/v1/userinfo', { headers: { Authorization: `Bearer ${tokens.access_token}` } })
  if (!profileResponse.ok) throw Object.assign(new Error('Google profile could not be read.'), { status: 401 })
  const profile = await profileResponse.json()
  const data = await readAuth()
  let user = data.users.find(item => item.googleId === profile.sub)
  if (!user) {
    user = data.users.find(item => item.email === normalizeEmail(profile.email))
    if (user) user.googleId = profile.sub
    else {
      user = { id: crypto.randomUUID(), email: normalizeEmail(profile.email), googleId: profile.sub, createdAt: new Date().toISOString() }
      data.users.push(user)
    }
    await writeAuth(data)
  }
  return { token: await createSession(user.id), user: publicUser(user) }
}

export async function findUserByToken(token) {
  if (!token) return null
  const data = await readAuth()
  const session = data.sessions.find(item => item.token === token && item.expiresAt > Date.now())
  if (!session) return null
  const user = data.users.find(item => item.id === session.userId)
  return user ? publicUser(user) : null
}

export async function logout(token) {
  if (!token) return
  const data = await readAuth()
  const sessions = data.sessions.filter(session => session.token !== token)
  if (sessions.length !== data.sessions.length) await writeAuth({ ...data, sessions })
}

export function authMiddleware(req, res, next) {
  const token = tokenFromRequest(req)
  findUserByToken(token).then(user => {
    if (!user) return res.status(401).json({ error: 'Sign in to continue.' })
    req.user = user
    req.authToken = token
    next()
  }).catch(next)
}

export function sessionCookie(token) {
  return `figdoc_session=${token}; HttpOnly; Path=/; SameSite=Lax; Max-Age=${SESSION_TTL_MS / 1000}${process.env.NODE_ENV === 'production' ? '; Secure' : ''}`
}

export function clearSessionCookie() {
  return 'figdoc_session=; HttpOnly; Path=/; SameSite=Lax; Max-Age=0'
}
