import express from 'express';
import cors from 'cors';
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';

const app = express();
const prisma = new PrismaClient();
const PORT = process.env.PORT || 5000;
const JWT_SECRET = process.env.JWT_SECRET || 'sacc_super_secret_key_2026';
const JWT_REFRESH_SECRET = process.env.JWT_REFRESH_SECRET || 'sacc_super_refresh_secret_2026';

if (process.env.NODE_ENV === 'production' && (!process.env.JWT_SECRET || !process.env.JWT_REFRESH_SECRET)) {
  console.error('JWT_SECRET and JWT_REFRESH_SECRET must be set in production.');
  process.exit(1);
}

app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));

// Default Fallback Dynamic Config
const defaultDynamicConfig = {
  membershipPlans: [
    { id: 'essential', name: 'Essential', price: 99, callouts: 1, hoursPerCallout: 1 },
    { id: 'business', name: 'Business', price: 199, callouts: 2, hoursPerCallout: 1 },
    { id: 'premium', name: 'Premium', price: 399, callouts: 4, hoursPerCallout: 1 }
  ],
  additionalCalloutFee: 30,
  overageHourlyRate: 120,
  toiletOverflowDisclaimer: "Cleaning of the affected area and surrounding surfaces only. SA Emergency Cleaning Pty Ltd does not provide plumbing, blockage removal, drain clearing or toilet unclogging services.",
  tenureMinMonths: 6,
  redemptionRates: [
    { code: 'carpet_steam', name: 'Carpet Steam Cleaning', unit: 'm²', points: 5 },
    { code: 'carpet_encap', name: 'Carpet Encapsulation', unit: 'm²', points: 3 },
    { code: 'floor_scrubbing', name: 'Machine Floor Scrubbing', unit: 'm²', points: 4 },
    { code: 'pressure_clean', name: 'Pressure Cleaning', unit: 'm²', points: 4 },
    { code: 'tile_grout', name: 'Tile & Grout Cleaning', unit: 'm²', points: 7 },
    { code: 'win_internal', name: 'Internal Windows', unit: 'panel', points: 8 },
    { code: 'win_external', name: 'External Windows', unit: 'panel', points: 10 },
    { code: 'win_high', name: 'High-Level Windows', unit: 'panel', points: 18 },
    { code: 'deep_clean', name: 'Deep Cleaning', unit: 'hour', points: 100 },
    { code: 'high_dusting', name: 'High Dusting', unit: 'hour', points: 100 }
  ],
  incidentCategories: [
    'Spill', 'Vomit', 'Urine or faeces', 'Carpet stain', 'Water leak', 
    'Wet carpet', 'Toilet overflow', 'Broken glass', 'Oil or grease spill', 
    'Bin leakage', 'Emergency bathroom cleaning', 'Emergency kitchen cleaning', 
    'Minor graffiti', 'Other'
  ]
};

// 1. HEALTH CHECK
app.get('/api/health', (req, res) => {
  res.json({ status: 'ONLINE', database: 'Prisma SQLite/PostgreSQL Connected', timestamp: new Date() });
});

// ADELAIDE LOCATION VALIDATION UTILITY
const ADELAIDE_SUBURBS = [
  'Adelaide', 'North Adelaide', 'Port Adelaide', 'Norwood', 'Unley', 'Glenelg', 
  'Mawson Lakes', 'Marion', 'Salisbury', 'Elizabeth', 'Prospect', 'Modbury', 
  'Campbelltown', 'Burnside', 'Mitcham', 'Glen Osmond', 'St Peters', 'Henley Beach',
  'Semaphor', 'West Lakes', 'Golden Grove', 'Mount Barker', 'Gawler', 'Christies Beach'
];

function isAdelaideLocation(addressText) {
  if (!addressText) return false;
  const lower = addressText.toLowerCase();
  // Check for 'adelaide', 'sa 5', or any adelaide suburb
  if (lower.includes('adelaide') || lower.includes('sa 5') || lower.includes('south australia')) {
    return true;
  }
  return ADELAIDE_SUBURBS.some(suburb => lower.includes(suburb.toLowerCase()));
}

// 1. AUTHENTICATION ENDPOINTS
const authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) return res.status(401).json({ error: 'Access token required.' });

  jwt.verify(token, JWT_SECRET, (err, user) => {
    if (err) {
      if (err.name === 'TokenExpiredError') {
        return res.status(401).json({ error: 'TokenExpiredError' });
      }
      return res.status(403).json({ error: 'Invalid or expired access token.' });
    }
    req.user = user;
    next();
  });
};

// Every /api route needs a valid login except these.
// The PDF report checks its own token (passed as ?token=) because it opens in a new browser tab.
const PUBLIC_ROUTES = [
  ['GET', /^\/api\/health$/],
  ['GET', /^\/api\/config$/],
  ['POST', /^\/api\/auth\/(register|login|refresh)$/],
  ['GET', /^\/api\/jobs\/[^/]+\/pdf-report$/]
];

app.use('/api', (req, res, next) => {
  const path = req.originalUrl.split('?')[0];
  const isPublic = PUBLIC_ROUTES.some(([method, pattern]) => method === req.method && pattern.test(path));
  if (isPublic) return next();
  authenticateToken(req, res, next);
});

// Restrict a route to some roles, e.g. requireRole('ADMIN', 'CONFIG')
const requireRole = (...roles) => (req, res, next) => {
  if (!req.user || !roles.includes(req.user.role)) {
    return res.status(403).json({ error: 'You do not have permission to perform this action.' });
  }
  next();
};

// Customers may only touch their own organization. Staff roles can see every organization.
const canAccessOrganization = (req, organizationId) =>
  req.user.role !== 'CUSTOMER' || req.user.organizationId === organizationId;

const forbidden = (res) => res.status(403).json({ error: 'Access denied.' });

const clientIp = (req) =>
  String(req.headers['x-forwarded-for'] || req.socket?.remoteAddress || '').split(',')[0].trim() || null;

// LOGIN HISTORY (LoginLog table). Logging must never break the request itself.
async function recordLogin(req, { userId = null, email, role = null, event, reason = null }) {
  try {
    await prisma.loginLog.create({
      data: {
        userId,
        email: (email || '').toLowerCase(),
        success: event === 'LOGIN_SUCCESS',
        role,
        event,
        reason,
        ipAddress: clientIp(req),
        userAgent: req.headers['user-agent'] || null
      }
    });
  } catch (error) {
    console.warn('LoginLog write failed:', error.message);
  }
}

// CHANGE HISTORY (AuditLog table). Actor defaults to the logged-in user.
async function recordAudit(req, { action, entityType, entityId = null, diff = null, actor = null }) {
  try {
    const who = actor || req.user || {};
    await prisma.auditLog.create({
      data: {
        userId: who.userId || null,
        userEmail: who.email || null,
        userRole: who.role || null,
        action,
        entityType,
        entityId: entityId ? String(entityId) : null,
        diffJson: diff ? JSON.stringify(diff) : null,
        ipAddress: clientIp(req)
      }
    });
  } catch (error) {
    console.warn('AuditLog write failed:', error.message);
  }
}

// Field-by-field before/after for the fields that actually changed
function changedFields(before, after, fields) {
  const changes = {};
  for (const field of fields) {
    const a = after[field] instanceof Date ? after[field].toISOString() : after[field];
    const b = before[field] instanceof Date ? before[field].toISOString() : before[field];
    if (a !== undefined && a !== b) changes[field] = { from: b ?? null, to: a ?? null };
  }
  return changes;
}

// Temporary password for accounts an admin creates. It is returned once so the admin can pass it on.
function generateTempPassword() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789';
  let out = '';
  for (let i = 0; i < 10; i++) out += chars[crypto.randomInt(chars.length)];
  return `${out}!7`;
}

const parseJob = (job) => ({
  ...job,
  photos: JSON.parse(job.photosJson || '[]'),
  videos: JSON.parse(job.videosJson || '[]')
});

// Job statuses the API accepts
const JOB_STATUSES = [
  'NEW', 'SUBMITTED', 'UNDER_REVIEW', 'MORE_INFO_REQUIRED', 'DECLINED', 'CONVERTED_TO_QUOTE',
  'ACCEPTED', 'TECH_ASSIGNED', 'TECHNICIAN_ASSIGNED', 'TRAVELLING', 'ARRIVED', 'IN_PROGRESS',
  'UNABLE_TO_ACCESS', 'COMPLETED', 'REPORT_ISSUED', 'CLOSED', 'CANCELLED'
];
const FINISHED_STATUSES = ['COMPLETED', 'REPORT_ISSUED', 'CLOSED', 'CANCELLED', 'DECLINED'];

// The steps a technician may take, in order: current status -> allowed next statuses
const TECHNICIAN_TRANSITIONS = {
  NEW: ['ACCEPTED'],
  SUBMITTED: ['ACCEPTED'],
  TECH_ASSIGNED: ['ACCEPTED'],
  TECHNICIAN_ASSIGNED: ['ACCEPTED'],
  ACCEPTED: ['TRAVELLING'],
  TRAVELLING: ['ARRIVED'],
  ARRIVED: ['IN_PROGRESS', 'UNABLE_TO_ACCESS'],
  IN_PROGRESS: ['COMPLETED']
};

// A technician only works on jobs assigned to them (jobs store the technician's name)
async function isJobAssignedToTechnician(req, job) {
  if (!req.user.technicianId) return false;
  const tech = await prisma.technician.findUnique({ where: { id: req.user.technicianId } });
  return Boolean(tech && job.technicianName && job.technicianName.toLowerCase() === tech.name.toLowerCase());
}

app.post('/api/auth/register', async (req, res) => {
  try {
    const { 
      businessName, abn, primaryContactName, phoneNumber, email, password, 
      membershipPlan, paymentType, paymentDetails, address, locationName, isCreatedByAdmin 
    } = req.body;

    if (!businessName || !email || !primaryContactName || !phoneNumber || !password) {
      return res.status(400).json({ error: 'Missing required fields.' });
    }

    const targetAddress = address || locationName || '';
    if (!isAdelaideLocation(targetAddress)) {
      return res.status(400).json({ 
        error: 'Location Error: Service is currently restricted exclusively to Adelaide, South Australia locations (Postcodes 5000-5199).' 
      });
    }

    const existingUser = await prisma.user.findUnique({ where: { email: email.toLowerCase() } });
    if (existingUser) {
      return res.status(400).json({ error: 'An account with this email address already exists.' });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const customer = await prisma.organization.create({
      data: {
        businessName,
        abn: abn || '48 123 456 789',
        primaryContactName,
        phoneNumber,
        email: email.toLowerCase(),
        membershipPlan: membershipPlan || 'business',
        paymentMethod: 'PayTo Bank Direct',
        paymentType: paymentType || 'DIRECT_DEBIT',
        subscriptionStatus: 'ACTIVE',
        consecutiveMonths: 1,
        pointsBalance: 100,
        calloutsUsed: 0,
        locations: {
          create: [
            {
              name: locationName || 'Primary Adelaide Site',
              address: targetAddress,
              contactName: primaryContactName,
              contactPhone: phoneNumber,
              accessInstructions: 'Main Entrance Keypad / Reception Desk',
              securityNotes: 'Standard Commercial Site - Adelaide SA'
            }
          ]
        }
      },
      include: { locations: true }
    });

    const newUser = await prisma.user.create({
      data: {
        email: email.toLowerCase(),
        password: hashedPassword,
        name: primaryContactName,
        role: 'CUSTOMER',
        organizationId: customer.id
      }
    });

    await recordAudit(req, {
      action: 'COMPANY_REGISTERED',
      entityType: 'Organization',
      entityId: customer.id,
      diff: { businessName, membershipPlan: customer.membershipPlan, email: customer.email },
      actor: { userId: newUser.id, email: newUser.email, role: 'CUSTOMER' }
    });

    res.json({
      success: true,
      message: `Company ${businessName} registered successfully!`,
      customer
    });

  } catch (error) {
    if (error.code === 'P2002') {
      return res.status(400).json({ error: 'A company with this email address is already registered.' });
    }
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/auth/login', async (req, res) => {
  const { email, password } = req.body || {};
  const input = (email || '').trim().toLowerCase();

  try {
    if (!input || !password) {
      await recordLogin(req, { email: input, event: 'LOGIN_FAILED', reason: 'MISSING_FIELDS' });
      return res.status(400).json({ error: 'Email and password are required.' });
    }

    // Login is checked against the User table only. There are no built-in or fallback users.
    const user = await prisma.user.findUnique({
      where: { email: input },
      include: { organization: true, technician: true }
    });

    if (!user) {
      await recordLogin(req, { email: input, event: 'LOGIN_FAILED', reason: 'UNKNOWN_EMAIL' });
      return res.status(401).json({ error: 'Invalid email or password.' });
    }

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      await recordLogin(req, { userId: user.id, email: input, role: user.role, event: 'LOGIN_FAILED', reason: 'WRONG_PASSWORD' });
      return res.status(401).json({ error: 'Invalid email or password.' });
    }

    const payload = {
      userId: user.id,
      email: user.email,
      role: user.role,
      organizationId: user.organizationId,
      technicianId: user.technicianId
    };

    const accessToken = jwt.sign(payload, JWT_SECRET, { expiresIn: '15m' });
    const refreshToken = jwt.sign({ userId: user.id }, JWT_REFRESH_SECRET, { expiresIn: '7d' });

    await prisma.user.update({
      where: { id: user.id },
      data: { refreshToken, lastLoginAt: new Date() }
    });
    await recordLogin(req, { userId: user.id, email: user.email, role: user.role, event: 'LOGIN_SUCCESS' });

    const userProfile = {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role.toLowerCase(),
      avatar: 'https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?auto=format&fit=crop&w=150&q=80'
    };

    if (user.role === 'CUSTOMER' && user.organization) {
      userProfile.businessId = user.organization.id;
      userProfile.businessName = user.organization.businessName;
    } else if (user.role === 'TECHNICIAN' && user.technician) {
      userProfile.techId = user.technicianId;
      userProfile.status = user.technician.status;
    }

    res.json({ success: true, accessToken, refreshToken, user: userProfile });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/auth/logout', async (req, res) => {
  try {
    await prisma.user.updateMany({
      where: { id: req.user.userId },
      data: { refreshToken: null }
    });
    await recordLogin(req, { userId: req.user.userId, email: req.user.email, role: req.user.role, event: 'LOGOUT' });
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/auth/refresh', async (req, res) => {
  const { refreshToken } = req.body || {};
  if (!refreshToken) return res.status(401).json({ error: 'Refresh token required' });

  let decoded;
  try {
    decoded = jwt.verify(refreshToken, JWT_REFRESH_SECRET);
  } catch (error) {
    await recordLogin(req, { email: '', event: 'REFRESH_FAILED', reason: 'INVALID_TOKEN' });
    return res.status(403).json({ error: 'Invalid or expired refresh token' });
  }

  try {
    const user = await prisma.user.findUnique({ where: { id: decoded.userId } });

    if (!user || user.refreshToken !== refreshToken) {
      await recordLogin(req, { userId: decoded.userId, email: user?.email || '', role: user?.role, event: 'REFRESH_FAILED', reason: 'TOKEN_NOT_CURRENT' });
      return res.status(403).json({ error: 'Invalid refresh token' });
    }

    const payload = {
      userId: user.id,
      email: user.email,
      role: user.role,
      organizationId: user.organizationId,
      technicianId: user.technicianId
    };

    const accessToken = jwt.sign(payload, JWT_SECRET, { expiresIn: '15m' });
    const newRefreshToken = jwt.sign({ userId: user.id }, JWT_REFRESH_SECRET, { expiresIn: '7d' });

    await prisma.user.update({
      where: { id: user.id },
      data: { refreshToken: newRefreshToken }
    });

    res.json({ accessToken, refreshToken: newRefreshToken });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// 2. DYNAMIC CONFIGURATION ENDPOINTS (ZERO-CODE ENGINE)
app.get('/api/config', async (req, res) => {
  try {
    const configRecord = await prisma.systemDynamicConfig.findUnique({
      where: { configKey: 'MAIN_CONFIG' }
    });
    if (configRecord) {
      return res.json(JSON.parse(configRecord.configValue));
    }
    // Return default if not seeded
    res.json(defaultDynamicConfig);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.put('/api/config', requireRole('ADMIN', 'CONFIG'), async (req, res) => {
  try {
    const updatedConfig = req.body;
    if (!updatedConfig || !Array.isArray(updatedConfig.membershipPlans) || updatedConfig.membershipPlans.length === 0) {
      return res.status(400).json({ error: 'Configuration must include at least one membership plan.' });
    }
    const existing = await prisma.systemDynamicConfig.findUnique({ where: { configKey: 'MAIN_CONFIG' } });
    await prisma.systemDynamicConfig.upsert({
      where: { configKey: 'MAIN_CONFIG' },
      update: { configValue: JSON.stringify(updatedConfig) },
      create: { configKey: 'MAIN_CONFIG', configValue: JSON.stringify(updatedConfig) }
    });
    await recordAudit(req, {
      action: 'CONFIG_UPDATED',
      entityType: 'SystemDynamicConfig',
      entityId: 'MAIN_CONFIG',
      diff: { before: existing ? JSON.parse(existing.configValue) : defaultDynamicConfig, after: updatedConfig }
    });
    res.json({ message: 'Dynamic Configuration updated in Database successfully', config: updatedConfig });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// 3. CUSTOMER BUSINESS ACCOUNTS & LOCATIONS ENDPOINTS
app.get('/api/customers', async (req, res) => {
  try {
    // A customer only receives their own company
    const where = req.user.role === 'CUSTOMER' ? { id: req.user.organizationId || '__none__' } : {};
    const customers = await prisma.organization.findMany({
      where,
      include: { locations: true },
      orderBy: { createdAt: 'asc' }
    });
    res.json(customers);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/customers/:id', async (req, res) => {
  try {
    if (!canAccessOrganization(req, req.params.id)) return forbidden(res);
    const customer = await prisma.organization.findUnique({
      where: { id: req.params.id },
      include: { locations: true }
    });
    if (!customer) return res.status(404).json({ error: 'Customer not found' });
    res.json(customer);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.put('/api/customers/:id/profile', requireRole('CUSTOMER', 'ADMIN'), async (req, res) => {
  try {
    if (!canAccessOrganization(req, req.params.id)) return forbidden(res);
    const { businessName, primaryContactName, phoneNumber, email, password } = req.body;

    const before = await prisma.organization.findUnique({ where: { id: req.params.id } });
    if (!before) return res.status(404).json({ error: 'Customer not found' });

    const updateData = {};
    if (businessName) updateData.businessName = businessName;
    if (primaryContactName) updateData.primaryContactName = primaryContactName;
    if (phoneNumber) updateData.phoneNumber = phoneNumber;
    if (email) updateData.email = email.trim().toLowerCase();

    if (password !== undefined && password !== null && password !== '' && String(password).length < 8) {
      return res.status(400).json({ error: 'New password must be at least 8 characters.' });
    }

    // The login account of this company: the signed-in customer, or the user with the company email
    const loginUser = req.user.role === 'CUSTOMER'
      ? await prisma.user.findUnique({ where: { id: req.user.userId } })
      : await prisma.user.findFirst({ where: { organizationId: req.params.id, email: before.email } });

    if (updateData.email && updateData.email !== before.email) {
      const taken = await prisma.user.findUnique({ where: { email: updateData.email } });
      if (taken && taken.id !== loginUser?.id) {
        return res.status(400).json({ error: 'An account with this email address already exists.' });
      }
    }

    const customer = await prisma.$transaction(async (tx) => {
      const updated = await tx.organization.update({
        where: { id: req.params.id },
        data: updateData,
        include: { locations: true }
      });
      // The password and login email live on the User row, not on Organization
      if (loginUser) {
        const userData = {};
        if (password) userData.password = await bcrypt.hash(String(password), 10);
        if (updateData.email && loginUser.email === before.email) userData.email = updateData.email;
        if (primaryContactName && loginUser.email === before.email) userData.name = primaryContactName;
        if (Object.keys(userData).length) await tx.user.update({ where: { id: loginUser.id }, data: userData });
      }
      return updated;
    });

    const diff = changedFields(before, updateData, ['businessName', 'primaryContactName', 'phoneNumber', 'email']);
    if (password) diff.password = 'changed';
    await recordAudit(req, { action: 'PROFILE_UPDATED', entityType: 'Organization', entityId: customer.id, diff });

    res.json({ success: true, message: 'Profile updated successfully!', customer });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.put('/api/customers/:id/plan', requireRole('CUSTOMER', 'ADMIN'), async (req, res) => {
  try {
    if (!canAccessOrganization(req, req.params.id)) return forbidden(res);
    const { membershipPlan } = req.body;
    if (!['essential', 'business', 'premium'].includes(membershipPlan)) {
      return res.status(400).json({ error: 'Unknown membership plan.' });
    }
    const before = await prisma.organization.findUnique({ where: { id: req.params.id } });
    if (!before) return res.status(404).json({ error: 'Customer not found' });
    const customer = await prisma.organization.update({
      where: { id: req.params.id },
      data: { membershipPlan },
      include: { locations: true }
    });
    await recordAudit(req, {
      action: 'PLAN_CHANGED',
      entityType: 'Organization',
      entityId: customer.id,
      diff: { membershipPlan: { from: before.membershipPlan, to: membershipPlan } }
    });
    res.json({ 
      success: true, 
      message: `Membership plan updated to ${membershipPlan.toUpperCase()}!`, 
      customer 
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/customers/:id/cancel-subscription', requireRole('CUSTOMER', 'ADMIN'), async (req, res) => {
  try {
    if (!canAccessOrganization(req, req.params.id)) return forbidden(res);
    const before = await prisma.organization.findUnique({ where: { id: req.params.id } });
    if (!before) return res.status(404).json({ error: 'Customer not found' });
    const customer = await prisma.organization.update({
      where: { id: req.params.id },
      data: { subscriptionStatus: 'CANCELLED' },
      include: { locations: true }
    });
    await recordAudit(req, {
      action: 'SUBSCRIPTION_CANCELLED',
      entityType: 'Organization',
      entityId: customer.id,
      diff: { subscriptionStatus: { from: before.subscriptionStatus, to: 'CANCELLED' } }
    });
    res.json({ 
      success: true, 
      message: 'Subscription has been cancelled. Access will remain active until the current billing cycle ends.', 
      customer 
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// 4. EMERGENCY REQUESTS & DISPATCH ENDPOINTS
app.get('/api/jobs', async (req, res) => {
  try {
    const where = req.user.role === 'CUSTOMER' ? { organizationId: req.user.organizationId || '__none__' } : {};
    const jobs = await prisma.emergencyRequest.findMany({
      where,
      orderBy: { submittedAt: 'desc' }
    });
    res.json(jobs.map(parseJob));
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// One job with its full status timeline (used by the PDF download and job details)
app.get('/api/jobs/:id', async (req, res) => {
  try {
    const job = await prisma.emergencyRequest.findUnique({
      where: { id: req.params.id },
      include: { statusEvents: { orderBy: { createdAt: 'asc' } } }
    });
    if (!job) return res.status(404).json({ error: 'Emergency request job not found.' });
    if (!canAccessOrganization(req, job.organizationId)) return forbidden(res);
    res.json(parseJob(job));
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/jobs', requireRole('CUSTOMER', 'ADMIN'), async (req, res) => {
  try {
    // A customer always books for their own company; an admin picks the company (hotline booking)
    const organizationId = req.user.role === 'CUSTOMER' ? req.user.organizationId : req.body.organizationId;
    if (!organizationId) return res.status(400).json({ error: 'Customer company is required.' });

    const org = await prisma.organization.findUnique({ where: { id: organizationId } });
    if (!org) return res.status(404).json({ error: 'Customer company not found.' });
    if (org.subscriptionStatus === 'CANCELLED') {
      return res.status(400).json({ error: 'This membership has been cancelled. Emergency requests are not available.' });
    }
    if (!req.body.description || !req.body.onsiteContact || !req.body.onsitePhone) {
      return res.status(400).json({ error: 'Description, on-site contact and on-site phone are required.' });
    }

    const planId = org.membershipPlan || 'business';
    let allowedCallouts = 2;
    if (planId === 'essential') allowedCallouts = 1;
    if (planId === 'premium') allowedCallouts = 4;

    if (org.calloutsUsed >= allowedCallouts) {
      return res.status(400).json({
        error: `Call-out Limit Exhausted: You have used all ${org.calloutsUsed} of ${allowedCallouts} call-out(s) for your ${planId.toUpperCase()} membership plan. Please upgrade your plan to request additional emergency cleanings.`
      });
    }

    // Use the chosen site if it belongs to this company, otherwise the company's first site
    let location = req.body.locationId
      ? await prisma.location.findFirst({ where: { id: req.body.locationId, organizationId } })
      : null;
    if (!location) location = await prisma.location.findFirst({ where: { organizationId }, orderBy: { createdAt: 'asc' } });
    if (!location) {
      location = await prisma.location.create({
        data: {
          organizationId,
          name: req.body.locationName || 'Primary Site',
          address: req.body.address || 'Adelaide, SA',
          contactName: req.body.onsiteContact || req.body.customerName || 'Onsite Contact',
          contactPhone: req.body.onsitePhone || '0800000000'
        }
      });
    }

    const source = req.user.role === 'ADMIN' ? (req.body.source || 'HOTLINE') : 'PORTAL';
    const count = await prisma.emergencyRequest.count();
    const jobNumber = `SACC-${new Date().getFullYear()}-${1000 + count + 1}`;

    const newJob = await prisma.$transaction(async (tx) => {
      const job = await tx.emergencyRequest.create({
        data: {
          jobNumber,
          organizationId,
          locationId: location.id,
          customerName: req.body.customerName || org.businessName,
          locationName: req.body.locationName || location.name,
          address: req.body.address || location.address,
          category: req.body.category || 'General Hazard',
          description: req.body.description,
          affectedArea: parseFloat(req.body.affectedArea) || 25,
          incidentTime: req.body.incidentTime ? new Date(req.body.incidentTime) : new Date(),
          isOngoing: req.body.isOngoing !== undefined ? Boolean(req.body.isOngoing) : true,
          isSafeToAccess: req.body.isSafeToAccess !== undefined ? Boolean(req.body.isSafeToAccess) : true,
          onsiteContact: req.body.onsiteContact,
          onsitePhone: req.body.onsitePhone,
          accessInstructions: req.body.accessInstructions,
          accessRestrictions: req.body.accessRestrictions,
          parkingInstructions: req.body.parkingInstructions,
          status: 'NEW',
          source,
          submittedAt: new Date(),
          targetAttendanceAt: new Date(Date.now() + 3 * 60 * 60 * 1000), // 3 hrs (2-4 hr SLA target)
          photosJson: JSON.stringify(req.body.photos || []),
          videosJson: JSON.stringify(req.body.videos || [])
        }
      });
      await tx.jobStatusEvent.create({
        data: { jobId: job.id, fromStatus: '', toStatus: 'NEW', changedByUserId: req.user.userId, notes: `Created via ${source}` }
      });
      // Update Customer Callouts Used Counter
      await tx.organization.update({
        where: { id: organizationId },
        data: { calloutsUsed: { increment: 1 } }
      });
      return job;
    });

    await recordAudit(req, {
      action: 'JOB_CREATED',
      entityType: 'EmergencyRequest',
      entityId: newJob.id,
      diff: { jobNumber, organizationId, category: newJob.category, source }
    });

    res.json(parseJob(newJob));
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// EDIT EMERGENCY REQUEST (Allowed only when status is NEW or SUBMITTED)
app.put('/api/jobs/:id', requireRole('CUSTOMER', 'ADMIN'), async (req, res) => {
  try {
    const existingJob = await prisma.emergencyRequest.findUnique({
      where: { id: req.params.id }
    });

    if (!existingJob) {
      return res.status(404).json({ error: 'Emergency request job not found.' });
    }
    if (!canAccessOrganization(req, existingJob.organizationId)) return forbidden(res);

    if (!['NEW', 'SUBMITTED'].includes(existingJob.status)) {
      return res.status(400).json({ error: 'Cannot edit request: Job has already been accepted or dispatched by admin operations.' });
    }

    const data = {
      category: req.body.category !== undefined ? req.body.category : existingJob.category,
      description: req.body.description !== undefined ? req.body.description : existingJob.description,
      affectedArea: req.body.affectedArea !== undefined ? parseFloat(req.body.affectedArea) : existingJob.affectedArea,
      incidentTime: req.body.incidentTime ? new Date(req.body.incidentTime) : existingJob.incidentTime,
      isOngoing: req.body.isOngoing !== undefined ? Boolean(req.body.isOngoing) : existingJob.isOngoing,
      isSafeToAccess: req.body.isSafeToAccess !== undefined ? Boolean(req.body.isSafeToAccess) : existingJob.isSafeToAccess,
      onsiteContact: req.body.onsiteContact !== undefined ? req.body.onsiteContact : existingJob.onsiteContact,
      onsitePhone: req.body.onsitePhone !== undefined ? req.body.onsitePhone : existingJob.onsitePhone,
      accessInstructions: req.body.accessInstructions !== undefined ? req.body.accessInstructions : existingJob.accessInstructions,
      accessRestrictions: req.body.accessRestrictions !== undefined ? req.body.accessRestrictions : existingJob.accessRestrictions,
      parkingInstructions: req.body.parkingInstructions !== undefined ? req.body.parkingInstructions : existingJob.parkingInstructions,
      photosJson: req.body.photos ? JSON.stringify(req.body.photos) : existingJob.photosJson,
      videosJson: req.body.videos ? JSON.stringify(req.body.videos) : existingJob.videosJson
    };

    const updatedJob = await prisma.emergencyRequest.update({
      where: { id: req.params.id },
      data
    });

    const diff = changedFields(existingJob, data, [
      'category', 'description', 'affectedArea', 'incidentTime', 'isOngoing', 'isSafeToAccess', 'onsiteContact',
      'onsitePhone', 'accessInstructions', 'accessRestrictions', 'parkingInstructions'
    ]);
    if (data.photosJson !== existingJob.photosJson) diff.photos = 'changed';
    if (data.videosJson !== existingJob.videosJson) diff.videos = 'changed';
    await recordAudit(req, { action: 'JOB_EDITED', entityType: 'EmergencyRequest', entityId: updatedJob.id, diff });

    res.json(parseJob(updatedJob));
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// STATUS CHANGES: admin can set any status; a technician moves only their own job, one step at a time.
// Every change is stored in JobStatusEvent, which the service report timeline is built from.
app.patch('/api/jobs/:id/status', requireRole('ADMIN', 'TECHNICIAN'), async (req, res) => {
  try {
    const { status, technicianName, notes } = req.body;
    const job = await prisma.emergencyRequest.findUnique({ where: { id: req.params.id } });
    if (!job) return res.status(404).json({ error: 'Emergency request job not found.' });

    const newStatus = status || job.status;
    if (!JOB_STATUSES.includes(newStatus)) {
      return res.status(400).json({ error: `Unknown status: ${newStatus}` });
    }

    if (req.user.role === 'TECHNICIAN') {
      if (technicianName !== undefined) {
        return res.status(403).json({ error: 'Only the admin desk can assign technicians.' });
      }
      if (!(await isJobAssignedToTechnician(req, job))) {
        return res.status(403).json({ error: 'This job is not assigned to you.' });
      }
      const allowed = TECHNICIAN_TRANSITIONS[job.status] || [];
      if (!allowed.includes(newStatus)) {
        return res.status(400).json({ error: `A job in ${job.status} cannot move to ${newStatus}.` });
      }
    }

    const now = new Date();
    const updateData = { status: newStatus };
    if (technicianName !== undefined) updateData.technicianName = technicianName;

    // Labour time comes from the server clock, not from the browser
    if (newStatus === 'IN_PROGRESS' && !job.workStartedAt) {
      updateData.workStartedAt = now;
      updateData.timerActive = true;
    }
    if (newStatus === 'COMPLETED') {
      updateData.completedAt = now;
      updateData.timerActive = false;
      if (job.workStartedAt) {
        updateData.timerMinutes = Math.max(1, Math.round((now - new Date(job.workStartedAt)) / 60000));
      }
    }

    const updatedJob = await prisma.$transaction(async (tx) => {
      const updated = await tx.emergencyRequest.update({ where: { id: job.id }, data: updateData });

      if (newStatus !== job.status || technicianName !== undefined) {
        await tx.jobStatusEvent.create({
          data: {
            jobId: job.id,
            fromStatus: job.status,
            toStatus: newStatus,
            changedByUserId: req.user.userId,
            notes: notes || (technicianName !== undefined ? `Assigned to ${technicianName}` : null)
          }
        });
      }

      // Keep the technician roster in step with the job
      const techName = updated.technicianName;
      if (techName && techName !== 'Unassigned') {
        const tech = await tx.technician.findFirst({ where: { name: techName } });
        if (tech) {
          if (FINISHED_STATUSES.includes(newStatus)) {
            if (tech.activeJobId === job.jobNumber || tech.activeJobId === job.id) {
              await tx.technician.update({ where: { id: tech.id }, data: { status: 'AVAILABLE', activeJobId: null } });
            }
          } else {
            await tx.technician.update({ where: { id: tech.id }, data: { status: 'ON_SITE', activeJobId: job.jobNumber } });
          }
        }
      }
      // Re-assigned: free the previous technician
      if (technicianName !== undefined && job.technicianName && job.technicianName !== technicianName) {
        const prev = await tx.technician.findFirst({ where: { name: job.technicianName } });
        if (prev && (prev.activeJobId === job.jobNumber || prev.activeJobId === job.id)) {
          await tx.technician.update({ where: { id: prev.id }, data: { status: 'AVAILABLE', activeJobId: null } });
        }
      }
      return updated;
    });

    await recordAudit(req, {
      action: technicianName !== undefined ? 'JOB_ASSIGNED' : 'JOB_STATUS_CHANGED',
      entityType: 'EmergencyRequest',
      entityId: job.id,
      diff: changedFields(job, updateData, ['status', 'technicianName', 'workStartedAt', 'completedAt', 'timerMinutes'])
    });

    res.json(parseJob(updatedJob));
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.delete('/api/jobs/reset-all', requireRole('ADMIN'), async (req, res) => {
  try {
    const deletedJobs = await prisma.$transaction(async (tx) => {
      await tx.jobStatusEvent.deleteMany({});
      const deleted = await tx.emergencyRequest.deleteMany({});
      await tx.organization.updateMany({ data: { calloutsUsed: 0 } });
      await tx.technician.updateMany({ data: { status: 'AVAILABLE', activeJobId: null } });
      return deleted;
    });
    await recordAudit(req, { action: 'JOBS_RESET', entityType: 'EmergencyRequest', diff: { deleted: deletedJobs.count } });
    res.json({ message: 'All emergency requests successfully cleared and callout counts reset to 0.', count: deletedJobs.count });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/customers', requireRole('ADMIN'), async (req, res) => {
  try {
    const { businessName, abn, primaryContactName, phoneNumber, email } = req.body;

    if (!businessName || businessName.trim().length < 2) {
      return res.status(400).json({ error: 'Validation Error: Business/Company name is required (at least 2 characters).' });
    }
    const cleanAbn = (abn || '').replace(/\s/g, '');
    if (!cleanAbn || !/^\d{11}$/.test(cleanAbn)) {
      return res.status(400).json({ error: 'Validation Error: Australian Business Number (ABN) must be exactly 11 digits.' });
    }
    if (!primaryContactName || primaryContactName.trim().length < 2) {
      return res.status(400).json({ error: 'Validation Error: Primary contact person name is required.' });
    }
    const cleanPhone = (phoneNumber || '').replace(/[\s\-\(\)\+]/g, '');
    if (!cleanPhone || !/^\d{8,12}$/.test(cleanPhone)) {
      return res.status(400).json({ error: 'Validation Error: Please provide a valid phone number (8 to 12 digits).' });
    }
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!email || !emailRegex.test(email.trim())) {
      return res.status(400).json({ error: 'Validation Error: Please enter a valid business email address.' });
    }
    if (req.body.address && !isAdelaideLocation(req.body.address)) {
      return res.status(400).json({ error: 'Location Error: Service is restricted to Adelaide, South Australia (postcodes 5000-5199).' });
    }

    const normEmail = email.trim().toLowerCase();
    const existingUser = await prisma.user.findUnique({ where: { email: normEmail } });
    const existingOrg = await prisma.organization.findUnique({ where: { email: normEmail } });
    if (existingUser || existingOrg) {
      return res.status(400).json({ error: 'An account with this email address already exists.' });
    }

    // Admin-created accounts get a random temporary password, shown once to the admin
    const tempPassword = req.body.password || generateTempPassword();
    const hashedPassword = await bcrypt.hash(tempPassword, 10);

    const customer = await prisma.$transaction(async (tx) => {
      const org = await tx.organization.create({
        data: {
          businessName: businessName.trim(),
          abn: req.body.abn,
          primaryContactName: primaryContactName.trim(),
          phoneNumber: req.body.phoneNumber,
          email: normEmail,
          membershipPlan: req.body.membershipPlan || 'business',
          paymentMethod: req.body.paymentMethod || 'PayTo Bank Direct',
          consecutiveMonths: 1,
          pointsBalance: 0,
          calloutsUsed: 0,
          locations: {
            create: Array.isArray(req.body.locations) && req.body.locations.length ? req.body.locations.map(l => ({
              name: l.name || 'Primary Site',
              address: l.address || req.body.address || 'Adelaide SA 5000',
              contactName: l.contactName || primaryContactName,
              contactPhone: l.contactPhone || phoneNumber,
              accessInstructions: l.accessInstructions || null,
              securityNotes: l.securityNotes || null
            })) : [
              {
                name: 'Primary Site',
                address: req.body.address || 'Adelaide SA 5000',
                contactName: primaryContactName,
                contactPhone: phoneNumber,
                accessInstructions: 'Main Door Access Keypad',
                securityNotes: 'Standard Site'
              }
            ]
          }
        },
        include: { locations: true }
      });
      await tx.user.create({
        data: {
          email: normEmail,
          password: hashedPassword,
          name: primaryContactName.trim(),
          role: 'CUSTOMER',
          organizationId: org.id
        }
      });
      return org;
    });

    await recordAudit(req, {
      action: 'CUSTOMER_CREATED',
      entityType: 'Organization',
      entityId: customer.id,
      diff: { businessName: customer.businessName, email: normEmail, membershipPlan: customer.membershipPlan }
    });

    res.json({ ...customer, loginEmail: normEmail, tempPassword: req.body.password ? undefined : tempPassword });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Account deletion (App Store 5.1.1(v)): the customer deletes their own company, or an admin deletes it
app.delete('/api/customers/:id', requireRole('CUSTOMER', 'ADMIN'), async (req, res) => {
  try {
    if (!canAccessOrganization(req, req.params.id)) return forbidden(res);
    const customer = await prisma.organization.findUnique({
      where: { id: req.params.id }
    });
    
    if (!customer) return res.status(404).json({ error: 'Customer not found' });

    await prisma.$transaction(async (tx) => {
      const jobs = await tx.emergencyRequest.findMany({ where: { organizationId: customer.id }, select: { id: true } });
      await tx.jobStatusEvent.deleteMany({ where: { jobId: { in: jobs.map(j => j.id) } } });
      await tx.emergencyRequest.deleteMany({ where: { organizationId: customer.id } });
      await tx.redemptionRequest.deleteMany({ where: { organizationId: customer.id } });
      await tx.user.deleteMany({ where: { organizationId: customer.id } });
      await tx.organization.delete({ where: { id: customer.id } });
    });

    await recordAudit(req, {
      action: 'CUSTOMER_DELETED',
      entityType: 'Organization',
      entityId: customer.id,
      diff: { businessName: customer.businessName, email: customer.email }
    });

    res.json({ success: true, message: 'Account and all associated data have been permanently deleted.' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// 5. TECHNICIAN FLEET ENDPOINTS
app.get('/api/technicians', requireRole('ADMIN', 'TECHNICIAN', 'CONFIG'), async (req, res) => {
  try {
    const technicians = await prisma.technician.findMany({
      include: { user: { select: { email: true } } },
      orderBy: { createdAt: 'asc' }
    });
    res.json(technicians.map(({ user, ...t }) => ({ ...t, email: user?.email || null })));
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

const isOwnTechnician = (req, techId) => req.user.role === 'ADMIN' || req.user.technicianId === techId;

app.patch('/api/technicians/:id/status', requireRole('ADMIN', 'TECHNICIAN'), async (req, res) => {
  try {
    if (!isOwnTechnician(req, req.params.id)) return forbidden(res);
    if (!['AVAILABLE', 'ON_SITE', 'OFF_DUTY'].includes(req.body.status)) {
      return res.status(400).json({ error: 'Status must be AVAILABLE, ON_SITE or OFF_DUTY.' });
    }
    const before = await prisma.technician.findUnique({ where: { id: req.params.id } });
    if (!before) return res.status(404).json({ error: 'Technician not found' });
    const tech = await prisma.technician.update({
      where: { id: req.params.id },
      data: { status: req.body.status, activeJobId: req.body.activeJobId || null }
    });
    await recordAudit(req, {
      action: 'TECHNICIAN_STATUS_CHANGED',
      entityType: 'Technician',
      entityId: tech.id,
      diff: changedFields(before, tech, ['status', 'activeJobId'])
    });
    res.json(tech);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// POST /api/technicians (Create technician + user login credentials)
app.post('/api/technicians', requireRole('ADMIN'), async (req, res) => {
  try {
    const { name, phone, email, password, status, rating } = req.body;

    if (!name || name.trim().length < 2) {
      return res.status(400).json({ error: 'Technician name is required (at least 2 characters).' });
    }
    const cleanPhone = (phone || '').replace(/[\s\-\(\)\+]/g, '');
    if (!cleanPhone || !/^\d{8,12}$/.test(cleanPhone)) {
      return res.status(400).json({ error: 'Please enter a valid phone number (8 to 12 digits).' });
    }
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (email && !emailRegex.test(email.trim())) {
      return res.status(400).json({ error: 'Please enter a valid email address.' });
    }
    const existingName = await prisma.technician.findFirst({ where: { name: name.trim() } });
    if (existingName) {
      return res.status(400).json({ error: 'A technician with this name already exists. Jobs are assigned by name, so names must be unique.' });
    }

    const techEmail = (email && email.trim())
      ? email.trim().toLowerCase()
      : `${name.trim().toLowerCase().replace(/[^a-z0-9]+/g, '.').replace(/^\.|\.$/g, '')}.${crypto.randomInt(1000, 9999)}@sacleaning.com.au`;
    const existingUser = await prisma.user.findUnique({ where: { email: techEmail } });
    if (existingUser) {
      return res.status(400).json({ error: 'An account with this email address already exists.' });
    }

    const tempPassword = password || generateTempPassword();
    const hashedPassword = await bcrypt.hash(tempPassword, 10);

    const { tech, user } = await prisma.$transaction(async (tx) => {
      const tech = await tx.technician.create({
        data: {
          name: name.trim(),
          phone: phone.trim(),
          status: status || 'AVAILABLE',
          rating: parseFloat(rating) || 5.0
        }
      });
      const user = await tx.user.create({
        data: {
          email: techEmail,
          password: hashedPassword,
          name: name.trim(),
          role: 'TECHNICIAN',
          technicianId: tech.id
        }
      });
      return { tech, user };
    });

    await recordAudit(req, {
      action: 'TECHNICIAN_CREATED',
      entityType: 'Technician',
      entityId: tech.id,
      diff: { name: tech.name, phone: tech.phone, email: user.email }
    });

    res.json({
      ...tech,
      email: user.email,
      userId: user.id,
      tempPassword: password ? undefined : tempPassword
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// PUT /api/technicians/:id (Update technician details)
app.put('/api/technicians/:id', requireRole('ADMIN'), async (req, res) => {
  try {
    const { name, phone, status, rating } = req.body;
    const before = await prisma.technician.findUnique({ where: { id: req.params.id } });
    if (!before) return res.status(404).json({ error: 'Technician not found' });
    if (status && !['AVAILABLE', 'ON_SITE', 'OFF_DUTY'].includes(status)) {
      return res.status(400).json({ error: 'Status must be AVAILABLE, ON_SITE or OFF_DUTY.' });
    }
    const data = {
      ...(name ? { name: name.trim() } : {}),
      ...(phone ? { phone } : {}),
      ...(status ? { status } : {}),
      ...(rating !== undefined ? { rating: parseFloat(rating) } : {})
    };
    const tech = await prisma.$transaction(async (tx) => {
      const tech = await tx.technician.update({ where: { id: req.params.id }, data });
      if (data.name) {
        await tx.user.updateMany({ where: { technicianId: req.params.id }, data: { name: data.name } });
        // Jobs store the technician's name, so keep open jobs pointing at the right person
        if (data.name !== before.name) {
          await tx.emergencyRequest.updateMany({
            where: { technicianName: before.name, status: { notIn: FINISHED_STATUSES } },
            data: { technicianName: data.name }
          });
        }
      }
      return tech;
    });

    await recordAudit(req, {
      action: 'TECHNICIAN_UPDATED',
      entityType: 'Technician',
      entityId: tech.id,
      diff: changedFields(before, data, ['name', 'phone', 'status', 'rating'])
    });

    res.json(tech);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// PUT /api/technicians/:id/profile (Technician self profile update)
app.put('/api/technicians/:id/profile', requireRole('ADMIN', 'TECHNICIAN'), async (req, res) => {
  try {
    if (!isOwnTechnician(req, req.params.id)) return forbidden(res);
    const { name, phone, password } = req.body;
    if (password && String(password).trim().length < 8) {
      return res.status(400).json({ error: 'New password must be at least 8 characters.' });
    }
    const before = await prisma.technician.findUnique({ where: { id: req.params.id } });
    if (!before) return res.status(404).json({ error: 'Technician not found' });

    const tech = await prisma.$transaction(async (tx) => {
      const tech = await tx.technician.update({
        where: { id: req.params.id },
        data: {
          ...(name ? { name: name.trim() } : {}),
          ...(phone ? { phone } : {})
        }
      });
      const userData = {};
      if (password && password.trim()) userData.password = await bcrypt.hash(password.trim(), 10);
      if (name) userData.name = name.trim();
      if (Object.keys(userData).length) {
        await tx.user.updateMany({ where: { technicianId: req.params.id }, data: userData });
      }
      if (name && name.trim() !== before.name) {
        await tx.emergencyRequest.updateMany({
          where: { technicianName: before.name, status: { notIn: FINISHED_STATUSES } },
          data: { technicianName: name.trim() }
        });
      }
      return tech;
    });

    const diff = changedFields(before, { name: name?.trim(), phone }, ['name', 'phone']);
    if (password) diff.password = 'changed';
    await recordAudit(req, { action: 'TECHNICIAN_PROFILE_UPDATED', entityType: 'Technician', entityId: tech.id, diff });

    res.json({ success: true, message: 'Technician profile updated successfully', technician: tech });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// DELETE /api/technicians/:id
app.delete('/api/technicians/:id', requireRole('ADMIN'), async (req, res) => {
  try {
    const before = await prisma.technician.findUnique({ where: { id: req.params.id } });
    if (!before) return res.status(404).json({ error: 'Technician not found' });
    await prisma.$transaction([
      prisma.user.deleteMany({ where: { technicianId: req.params.id } }),
      prisma.technician.delete({ where: { id: req.params.id } })
    ]);
    await recordAudit(req, {
      action: 'TECHNICIAN_DELETED',
      entityType: 'Technician',
      entityId: before.id,
      diff: { name: before.name, phone: before.phone }
    });
    res.json({ success: true, message: 'Technician removed successfully' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Multi-site management endpoints
app.post('/api/customers/:id/locations', requireRole('CUSTOMER', 'ADMIN'), async (req, res) => {
  try {
    if (!canAccessOrganization(req, req.params.id)) return forbidden(res);
    const { name, address, contactName, contactPhone, accessInstructions, securityNotes } = req.body;
    if (!name || !address) {
      return res.status(400).json({ error: 'Location name and street address are required.' });
    }
    if (!isAdelaideLocation(address)) {
      return res.status(400).json({ error: 'Location Error: Service is restricted to Adelaide, South Australia (postcodes 5000-5199).' });
    }
    const org = await prisma.organization.findUnique({ where: { id: req.params.id } });
    if (!org) return res.status(404).json({ error: 'Customer not found' });
    const location = await prisma.location.create({
      data: {
        organizationId: req.params.id,
        name,
        address,
        contactName: contactName || org.primaryContactName,
        contactPhone: contactPhone || org.phoneNumber,
        accessInstructions: accessInstructions || null,
        securityNotes: securityNotes || null
      }
    });
    await recordAudit(req, {
      action: 'LOCATION_CREATED',
      entityType: 'Location',
      entityId: location.id,
      diff: { organizationId: org.id, name, address }
    });
    res.json(location);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.put('/api/locations/:id', requireRole('CUSTOMER', 'ADMIN'), async (req, res) => {
  try {
    const before = await prisma.location.findUnique({ where: { id: req.params.id } });
    if (!before) return res.status(404).json({ error: 'Location not found' });
    if (!canAccessOrganization(req, before.organizationId)) return forbidden(res);
    const { name, address, contactName, contactPhone, accessInstructions, securityNotes } = req.body;
    if (address && !isAdelaideLocation(address)) {
      return res.status(400).json({ error: 'Location Error: Service is restricted to Adelaide, South Australia (postcodes 5000-5199).' });
    }
    const data = {
      ...(name ? { name } : {}),
      ...(address ? { address } : {}),
      ...(contactName ? { contactName } : {}),
      ...(contactPhone ? { contactPhone } : {}),
      ...(accessInstructions !== undefined ? { accessInstructions } : {}),
      ...(securityNotes !== undefined ? { securityNotes } : {})
    };
    const location = await prisma.location.update({ where: { id: req.params.id }, data });
    await recordAudit(req, {
      action: 'LOCATION_UPDATED',
      entityType: 'Location',
      entityId: location.id,
      diff: changedFields(before, data, ['name', 'address', 'contactName', 'contactPhone', 'accessInstructions', 'securityNotes'])
    });
    res.json(location);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// 6. REWARD POINTS & TENURE VERIFICATION ENDPOINTS
app.get('/api/redemptions', requireRole('CUSTOMER', 'ADMIN'), async (req, res) => {
  try {
    const where = req.user.role === 'CUSTOMER' ? { organizationId: req.user.organizationId || '__none__' } : {};
    const redemptions = await prisma.redemptionRequest.findMany({
      where,
      include: { organization: true, location: true },
      orderBy: { createdAt: 'desc' }
    });
    res.json(redemptions);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/redemptions', requireRole('CUSTOMER', 'ADMIN'), async (req, res) => {
  try {
    const { locationId, serviceCode, serviceName, quantity } = req.body;
    const organizationId = req.user.role === 'CUSTOMER' ? req.user.organizationId : req.body.organizationId;

    const org = await prisma.organization.findUnique({ where: { id: organizationId || '__none__' } });
    if (!org) return res.status(404).json({ error: 'Organization account not found.' });

    const location = await prisma.location.findFirst({ where: { id: locationId || '__none__', organizationId: org.id } });
    if (!location) return res.status(400).json({ error: 'Please choose one of your own sites.' });

    // Points are worked out on the server from the configured rate, not trusted from the browser
    const configRecord = await prisma.systemDynamicConfig.findUnique({ where: { configKey: 'MAIN_CONFIG' } });
    const config = configRecord ? JSON.parse(configRecord.configValue) : defaultDynamicConfig;
    const rate = (config.redemptionRates || []).find(r => r.code === serviceCode);
    const qty = parseFloat(quantity);
    if (!rate) return res.status(400).json({ error: 'Unknown redemption service.' });
    if (!qty || qty <= 0) return res.status(400).json({ error: 'Quantity must be more than zero.' });
    const calculatedPoints = Math.ceil(rate.points * qty);

    // Enforce 6-Month Tenure Verification Rule
    const minMonths = config.tenureMinMonths || 6;
    if (org.consecutiveMonths < minMonths) {
      return res.status(400).json({
        error: `Tenure Lock: Reward points redemptions unlock after ${minMonths} consecutive active membership months (Current Tenure: ${org.consecutiveMonths} month(s)).`
      });
    }

    // Check Points Balance
    if (org.pointsBalance < calculatedPoints) {
      return res.status(400).json({
        error: `Insufficient Points Balance: Required ${calculatedPoints} pts, Available ${org.pointsBalance} pts.`
      });
    }

    const redemption = await prisma.redemptionRequest.create({
      data: {
        organizationId: org.id,
        locationId: location.id,
        serviceCode,
        serviceName: serviceName || rate.name,
        quantity: qty,
        calculatedPoints,
        status: 'PENDING_APPROVAL'
      }
    });

    await recordAudit(req, {
      action: 'REDEMPTION_REQUESTED',
      entityType: 'RedemptionRequest',
      entityId: redemption.id,
      diff: { organizationId: org.id, serviceCode, quantity: qty, calculatedPoints }
    });

    res.json({ success: true, message: 'Redemption request submitted for Admin review.', redemption });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Approve or reject. Only a PENDING request can be decided, so approving twice never deducts twice.
app.patch('/api/redemptions/:id/status', requireRole('ADMIN'), async (req, res) => {
  try {
    const { status } = req.body; // APPROVED or REJECTED
    if (!['APPROVED', 'REJECTED'].includes(status)) {
      return res.status(400).json({ error: 'Status must be APPROVED or REJECTED.' });
    }

    const result = await prisma.$transaction(async (tx) => {
      const redemption = await tx.redemptionRequest.findUnique({ where: { id: req.params.id } });
      if (!redemption) return { code: 404, error: 'Redemption request not found' };
      if (redemption.status !== 'PENDING_APPROVAL') {
        return { code: 409, error: `This request was already ${redemption.status}.` };
      }
      if (status === 'APPROVED') {
        const org = await tx.organization.findUnique({ where: { id: redemption.organizationId } });
        if (org.pointsBalance < redemption.calculatedPoints) {
          return { code: 400, error: `Insufficient Points Balance: Required ${redemption.calculatedPoints} pts, Available ${org.pointsBalance} pts.` };
        }
      }
      // Conditional update: only succeeds while the request is still pending
      const changed = await tx.redemptionRequest.updateMany({
        where: { id: redemption.id, status: 'PENDING_APPROVAL' },
        data: { status }
      });
      if (changed.count !== 1) return { code: 409, error: 'This request was already decided.' };
      if (status === 'APPROVED') {
        await tx.organization.update({
          where: { id: redemption.organizationId },
          data: { pointsBalance: { decrement: redemption.calculatedPoints } }
        });
      }
      return { redemption: { ...redemption, status } };
    });

    if (result.error) return res.status(result.code).json({ error: result.error });

    await recordAudit(req, {
      action: status === 'APPROVED' ? 'REDEMPTION_APPROVED' : 'REDEMPTION_REJECTED',
      entityType: 'RedemptionRequest',
      entityId: result.redemption.id,
      diff: { status: { from: 'PENDING_APPROVAL', to: status }, points: result.redemption.calculatedPoints }
    });

    res.json({ success: true, message: `Redemption ${status} successfully.`, redemption: result.redemption });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// 7. INVOICING & BILLING LEDGER ENDPOINTS
app.get('/api/customers/:id/invoices', requireRole('CUSTOMER', 'ADMIN'), async (req, res) => {
  try {
    if (!canAccessOrganization(req, req.params.id)) return forbidden(res);
    const invoices = await prisma.invoice.findMany({
      where: { organizationId: req.params.id },
      orderBy: { createdAt: 'desc' }
    });
    res.json(invoices);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/customers/:id/invoices', requireRole('ADMIN'), async (req, res) => {
  try {
    const org = await prisma.organization.findUnique({ where: { id: req.params.id } });
    if (!org) return res.status(404).json({ error: 'Customer not found' });
    const count = await prisma.invoice.count();
    const invoiceNumber = `INV-${new Date().getFullYear()}-${1000 + count + 1}`;
    const status = req.body.status || 'PAID';
    
    const invoice = await prisma.invoice.create({
      data: {
        invoiceNumber,
        organizationId: req.params.id,
        description: req.body.description || 'Emergency Cleaning Overage Charge',
        amount: parseFloat(req.body.amount || 120),
        status,
        paymentMethod: req.body.paymentMethod || org.paymentMethod,
        dueDate: req.body.dueDate ? new Date(req.body.dueDate) : new Date(),
        paidAt: status === 'PAID' ? new Date() : null
      }
    });

    await recordAudit(req, {
      action: 'INVOICE_CREATED',
      entityType: 'Invoice',
      entityId: invoice.id,
      diff: { invoiceNumber, organizationId: org.id, amount: invoice.amount, status }
    });

    res.json(invoice);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// 8. JOB EXTENSION & EXCEPTION ENDPOINTS
app.post('/api/jobs/:id/extension', requireRole('ADMIN', 'TECHNICIAN'), async (req, res) => {
  try {
    const job = await prisma.emergencyRequest.findUnique({ where: { id: req.params.id } });
    if (!job) return res.status(404).json({ error: 'Emergency request job not found.' });
    if (req.user.role === 'TECHNICIAN' && !(await isJobAssignedToTechnician(req, job))) {
      return res.status(403).json({ error: 'This job is not assigned to you.' });
    }
    const { extensionRequested, extensionApproved, additionalCharges } = req.body;
    const data = {
      extensionRequested: extensionRequested !== undefined ? extensionRequested : true,
      // Only the admin desk can approve an extension
      extensionApproved: req.user.role === 'ADMIN' && extensionApproved !== undefined ? extensionApproved : job.extensionApproved,
      additionalCharges: additionalCharges ? parseFloat(additionalCharges) : 120.00
    };
    const updatedJob = await prisma.emergencyRequest.update({ where: { id: req.params.id }, data });
    await recordAudit(req, {
      action: 'JOB_EXTENSION_UPDATED',
      entityType: 'EmergencyRequest',
      entityId: job.id,
      diff: changedFields(job, data, ['extensionRequested', 'extensionApproved', 'additionalCharges'])
    });
    res.json(parseJob(updatedJob));
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// 9b. LOGIN HISTORY AND CHANGE HISTORY (Admin only)
app.get('/api/login-logs', requireRole('ADMIN'), async (req, res) => {
  try {
    const limit = Math.min(parseInt(req.query.limit, 10) || 100, 500);
    const where = {};
    if (req.query.email) where.email = String(req.query.email).toLowerCase();
    if (req.query.event) where.event = String(req.query.event);
    const logs = await prisma.loginLog.findMany({ where, orderBy: { createdAt: 'desc' }, take: limit });
    res.json(logs);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/audit-logs', requireRole('ADMIN'), async (req, res) => {
  try {
    const limit = Math.min(parseInt(req.query.limit, 10) || 100, 500);
    const where = {};
    if (req.query.entityType) where.entityType = String(req.query.entityType);
    if (req.query.entityId) where.entityId = String(req.query.entityId);
    if (req.query.userId) where.userId = String(req.query.userId);
    const logs = await prisma.auditLog.findMany({ where, orderBy: { createdAt: 'desc' }, take: limit });
    res.json(logs.map(l => ({ ...l, diff: l.diffJson ? JSON.parse(l.diffJson) : null })));
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// 9. PRINTABLE PDF SERVICE REPORT ENDPOINT
// Opens in a new browser tab, so the access token comes as ?token= (or the normal Authorization header).
// All data, including the timeline, is read from the database (EmergencyRequest + JobStatusEvent).
const escapeHtml = (value) => String(value ?? '').replace(/[&<>"']/g, ch => (
  { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]
));

const TIMELINE_STAGES = [
  { label: '1. Request Submitted', statuses: ['NEW', 'SUBMITTED'] },
  { label: '2. Admin Dispatched', statuses: ['TECH_ASSIGNED', 'TECHNICIAN_ASSIGNED'] },
  { label: '3. Technician Accepted', statuses: ['ACCEPTED'] },
  { label: '4. En Route (Transit Start)', statuses: ['TRAVELLING'] },
  { label: '5. Arrived On-Site', statuses: ['ARRIVED'] },
  { label: '6. Cleaning Commenced', statuses: ['IN_PROGRESS'] },
  { label: '7. Job Completed', statuses: ['COMPLETED'] }
];

app.get('/api/jobs/:id/pdf-report', async (req, res) => {
  try {
    const headerToken = (req.headers['authorization'] || '').split(' ')[1];
    const token = req.query.token || headerToken;
    let viewer;
    try {
      viewer = jwt.verify(String(token || ''), JWT_SECRET);
    } catch (e) {
      return res.status(401).send('<h2>Please sign in to view this report.</h2>');
    }

    const job = await prisma.emergencyRequest.findUnique({
      where: { id: req.params.id },
      include: { organization: true, location: true, statusEvents: { orderBy: { createdAt: 'asc' } } }
    });

    if (!job) return res.status(404).send('<h2>Job record not found</h2>');
    if (viewer.role === 'CUSTOMER' && viewer.organizationId !== job.organizationId) {
      return res.status(403).send('<h2>Access denied.</h2>');
    }

    const photos = JSON.parse(job.photosJson || '[]');
    const fmt = (d, withDate = false) => d
      ? new Date(d).toLocaleString('en-AU', { timeZone: 'Australia/Adelaide', ...(withDate ? { dateStyle: 'medium' } : {}), timeStyle: 'short' })
      : 'Not recorded';

    // First time the job reached each stage, taken from JobStatusEvent
    const firstAt = (statuses) => {
      const ev = job.statusEvents.find(e => statuses.includes(e.toStatus));
      return ev ? ev.createdAt : null;
    };
    const stageTimes = TIMELINE_STAGES.map(s => (s.statuses.includes('NEW') ? (firstAt(s.statuses) || job.submittedAt) : firstAt(s.statuses)));
    stageTimes[5] = job.workStartedAt || stageTimes[5];
    stageTimes[6] = job.completedAt || stageTimes[6];

    const submittedFormatted = fmt(job.submittedAt, true);
    const arrivedAt = stageTimes[4];
    const responseTimeMinutes = arrivedAt ? Math.round((new Date(arrivedAt) - new Date(job.submittedAt)) / 60000) : null;
    const labourDurationMinutes = job.workStartedAt && job.completedAt
      ? Math.max(1, Math.round((new Date(job.completedAt) - new Date(job.workStartedAt)) / 60000))
      : (job.timerMinutes || 0);
    const slaStatus = !arrivedAt
      ? 'Not yet attended'
      : (job.targetAttendanceAt && new Date(arrivedAt) <= new Date(job.targetAttendanceAt) ? '✓ PASSED (On Schedule)' : '✗ MISSED');
    const actorFor = ['customerName', null, 'technicianName', null, 'locationName', null, null];
    const timelineRows = TIMELINE_STAGES.map((s, i) => `
                <tr style="border-bottom: 1px solid #e2e8f0;${i === 6 ? ' background: #ecfdf5;' : ''}">
                  <td style="padding: 8px;"><strong>${s.label}</strong></td>
                  <td style="padding: 8px;">${escapeHtml(fmt(stageTimes[i], i === 0 || i === 6))}</td>
                  <td style="padding: 8px;">${escapeHtml(actorFor[i] ? job[actorFor[i]] || '-' : (i === 1 ? 'SACC Operations Desk' : '-'))}</td>
                </tr>`).join('');
    const completedFormatted = fmt(job.completedAt, true);
    const isCompleted = ['COMPLETED', 'REPORT_ISSUED', 'CLOSED'].includes(job.status);

    const htmlReport = `
      <!DOCTYPE html>
      <html>
      <head>
        <title>SACC Service Completion Report - ${job.jobNumber}</title>
        <style>
          @media print {
            .no-print { display: none !important; }
            body { margin: 0 !important; padding: 15px !important; }
          }
          body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; margin: 40px; color: #1e293b; line-height: 1.5; background: #f8fafc; }
          .container { max-width: 900px; margin: 0 auto; background: white; padding: 35px; border-radius: 16px; box-shadow: 0 10px 25px rgba(0,0,0,0.05); border: 1px solid #e2e8f0; }
          .header { display: flex; justify-content: space-between; align-items: center; border-bottom: 3px solid #0286cd; padding-bottom: 20px; }
          .logo-title { font-size: 22px; font-weight: 900; color: #0286cd; }
          .badge { background: #e0f2fe; color: #0369a1; padding: 6px 14px; border-radius: 9999px; font-size: 13px; font-weight: 800; border: 1px solid #bae6fd; }
          .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; margin-top: 25px; }
          .card { background: #f8fafc; border: 1px solid #e2e8f0; padding: 18px; border-radius: 12px; font-size: 13px; }
          .card h4 { margin: 0 0 10px 0; font-size: 12px; text-transform: uppercase; color: #64748b; letter-spacing: 0.5px; }
          .photos { display: flex; gap: 15px; margin-top: 20px; flex-wrap: wrap; }
          .photos img { width: 150px; height: 150px; object-fit: cover; border-radius: 10px; border: 1px solid #cbd5e1; }
          .footer { margin-top: 40px; border-top: 1px solid #e2e8f0; padding-top: 20px; text-align: center; font-size: 11px; color: #94a3b8; }
        </style>
        ${req.query.download === 'true' ? '<script>window.onload = function() { setTimeout(function() { window.print(); }, 300); };</script>' : ''}
      </head>
      <body>
        <!-- Top Action Bar for PDF Download & Printing -->
        <div class="no-print" style="max-width: 900px; margin: 0 auto 20px auto; background: #0286cd; padding: 14px 24px; color: white; display: flex; justify-content: space-between; align-items: center; border-radius: 16px; box-shadow: 0 10px 25px rgba(2, 134, 205, 0.25);">
          <div style="font-weight: 800; font-size: 14px; display: flex; items-center; gap: 8px;">
            <span>📄 SACC Emergency Completion Report (${job.jobNumber})</span>
          </div>
          <div style="display: flex; gap: 10px;">
            <button onclick="window.print()" style="background: white; color: #0286cd; border: none; padding: 9px 18px; border-radius: 10px; font-weight: 900; font-size: 12px; cursor: pointer; box-shadow: 0 2px 5px rgba(0,0,0,0.1); display: inline-flex; align-items: center; gap: 6px;">
              📥 SAVE AS PDF
            </button>
            <button onclick="window.print()" style="background: #0f3cad; color: white; border: none; padding: 9px 18px; border-radius: 10px; font-weight: 800; font-size: 12px; cursor: pointer;">
              🖨️ PRINT REPORT
            </button>
          </div>
        </div>

        <div class="container">
          <div class="header">
            <div>
              <div class="logo-title">SA EMERGENCY CLEANING</div>
              <div style="font-size: 12px; color: #64748b; font-weight: 600; margin-top: 2px;">Emergency Response & Service Completion Audit Report</div>
            </div>
            <div>
              <span class="badge">JOB NO: ${job.jobNumber}</span>
            </div>
          </div>

          <div class="grid">
            <div class="card">
              <h4>Customer & Site Location</h4>
              <strong style="font-size: 14px; color: #0f172a;">${escapeHtml(job.customerName)}</strong><br/>
              <span style="color: #475569;">${escapeHtml(job.address)}</span><br/>
              <div style="margin-top: 6px; font-weight: 600;">On-site Contact: ${escapeHtml(job.onsiteContact)} (${escapeHtml(job.onsitePhone)})</div>
            </div>
            <div class="card">
              <h4>Incident & Attendance Summary</h4>
              Category: <strong style="color: #0f172a;">${escapeHtml(job.category)} Emergency</strong><br/>
              Submitted At: <strong>${submittedFormatted}</strong><br/>
              Assigned Technician: <strong>${escapeHtml(job.technicianName || 'Unassigned')}</strong><br/>
              Status: <span style="color: ${isCompleted ? '#059669' : '#b45309'}; font-weight: 800;">${isCompleted ? '✓ COMPLETED & SIGNED OFF' : escapeHtml(job.status)}</span>${isCompleted ? `<br/>Completed At: <strong>${escapeHtml(completedFormatted)}</strong>` : ''}
            </div>
          </div>

          <!-- JOB TIMING & SLA RESPONSE TIMELINE LOG -->
          <div style="margin-top: 25px;" class="card">
            <h4 style="color: #0286cd; border-bottom: 2px solid #e2e8f0; padding-bottom: 8px; margin-bottom: 12px;">⏱️ Job Timing & Response SLA Audit Log</h4>
            <table style="width: 100%; border-collapse: collapse; font-size: 12px;">
              <thead>
                <tr style="background: #f1f5f9; text-align: left; border-bottom: 2px solid #cbd5e1;">
                  <th style="padding: 9px;">Lifecycle Stage</th>
                  <th style="padding: 9px;">Timestamp</th>
                  <th style="padding: 9px;">Status / Actor</th>
                </tr>
              </thead>
              <tbody>${timelineRows}
              </tbody>
            </table>

            <div style="margin-top: 15px; display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 10px; text-align: center;">
              <div style="background: #eff6ff; padding: 10px; border-radius: 8px; border: 1px solid #bfdbfe;">
                <span style="font-size: 10px; color: #1e40af; font-weight: bold; text-transform: uppercase;">Total Response Time</span><br/>
                <strong style="font-size: 14px; color: #1d4ed8;">${responseTimeMinutes === null ? 'Not recorded' : responseTimeMinutes + ' Mins'}</strong>
              </div>
              <div style="background: #f0fdf4; padding: 10px; border-radius: 8px; border: 1px solid #bbf7d0;">
                <span style="font-size: 10px; color: #166534; font-weight: bold; text-transform: uppercase;">On-Site Labour Duration</span><br/>
                <strong style="font-size: 14px; color: #15803d;">${labourDurationMinutes} Mins</strong>
              </div>
              <div style="background: #faf5ff; padding: 10px; border-radius: 8px; border: 1px solid #e9d5ff;">
                <span style="font-size: 10px; color: #6b21a8; font-weight: bold; text-transform: uppercase;">2-4 Hr SLA Target Status</span><br/>
                <strong style="font-size: 14px; color: #7e22ce;">${slaStatus}</strong>
              </div>
            </div>
          </div>

          <div style="margin-top: 25px;" class="card">
            <h4>Work Performed & Scope Log</h4>
            <p style="color: #334155;">"${escapeHtml(job.description || 'Emergency cleaning and hazard mitigation completed in full.')}"</p>
            <p><strong>Work Labor Duration:</strong> ${labourDurationMinutes} Minutes (1-Hour Included Allowance)</p>
            <p><strong>Additional Overage Fees:</strong> $${job.additionalCharges || '0.00'}</p>
          </div>

          <div style="margin-top: 25px;">
            <h4 style="font-size: 12px; text-transform: uppercase; color: #64748b;">Photo Verification Evidence</h4>
            <div class="photos">
              ${photos.length > 0 ? photos.map(p => `<img src="${escapeHtml(p)}" alt="Incident Verification" />`).join('') : '<p style="color:#94a3b8; font-size:12px;">No photo attachments recorded.</p>'}
            </div>
          </div>

          <div class="footer">
            <p>© 2026 SA Emergency Cleaning Pty Ltd • 24/7 Emergency Response Desk • Adelaide, South Australia</p>
          </div>
        </div>
      </body>
      </html>
    `;

    if (req.query.download === 'true') {
      res.setHeader('Content-Type', 'text/html; charset=utf-8');
      res.setHeader('Content-Disposition', `attachment; filename="SACC-Completion-Report-${job.jobNumber || job.id}.html"`);
    } else {
      res.setHeader('Content-Type', 'text/html; charset=utf-8');
    }
    res.send(htmlReport);
  } catch (error) {
    res.status(500).send(`<h2>Error generating PDF report: ${escapeHtml(error.message)}</h2>`);
  }
});

// 10. OPERATIONS ANALYTICS & KPIS API (all figures computed from the database)
app.get('/api/analytics/summary', requireRole('ADMIN', 'CONFIG'), async (req, res) => {
  try {
    const totalJobs = await prisma.emergencyRequest.count();
    const activeJobs = await prisma.emergencyRequest.count({ where: { status: { in: ['NEW', 'SUBMITTED', 'ACCEPTED', 'TECH_ASSIGNED', 'TECHNICIAN_ASSIGNED', 'TRAVELLING', 'ARRIVED', 'IN_PROGRESS'] } } });
    const completedJobs = await prisma.emergencyRequest.count({ where: { status: { in: ['COMPLETED', 'REPORT_ISSUED', 'CLOSED'] } } });
    const totalCustomers = await prisma.organization.count();
    const activeCustomers = await prisma.organization.count({ where: { subscriptionStatus: 'ACTIVE' } });
    const pendingRedemptions = await prisma.redemptionRequest.count({ where: { status: 'PENDING_APPROVAL' } });

    // SLA and attendance time from the recorded ARRIVED events
    const arrivals = await prisma.jobStatusEvent.findMany({
      where: { toStatus: 'ARRIVED' },
      include: { job: { select: { submittedAt: true, targetAttendanceAt: true } } }
    });
    const firstArrival = new Map();
    for (const ev of arrivals) if (!firstArrival.has(ev.jobId)) firstArrival.set(ev.jobId, ev);
    const attended = [...firstArrival.values()];
    const onTime = attended.filter(ev => !ev.job.targetAttendanceAt || ev.createdAt <= ev.job.targetAttendanceAt).length;
    const avgAttendance = attended.length
      ? Math.round(attended.reduce((sum, ev) => sum + (ev.createdAt - ev.job.submittedAt) / 60000, 0) / attended.length)
      : null;

    const monthStart = new Date(new Date().getFullYear(), new Date().getMonth(), 1);
    const revenue = await prisma.invoice.aggregate({ _sum: { amount: true }, where: { status: 'PAID', createdAt: { gte: monthStart } } });

    res.json({
      totalJobs,
      activeJobs,
      completedJobs,
      totalCustomers,
      activeCustomers,
      pendingRedemptions,
      slaResponseSuccessRate: attended.length ? `${((onTime / attended.length) * 100).toFixed(1)}%` : 'No data yet',
      avgAttendanceTimeMinutes: avgAttendance,
      totalRevenueMonth: revenue._sum.amount || 0
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// START SERVER
app.listen(PORT, () => {
  console.log(`=======================================================`);
  console.log(`SACC Emergency Membership Backend API Server Running`);
  console.log(`Port: http://localhost:${PORT}`);
  console.log(`Health Check: http://localhost:${PORT}/api/health`);
  console.log(`=======================================================`);
});
