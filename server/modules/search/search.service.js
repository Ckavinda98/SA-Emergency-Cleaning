// Global search. Each role only searches records it is allowed to see:
//   customer    -> their own company's requests and sites
//   technician  -> jobs assigned to them
//   admin       -> every job, customer, site and technician
//   config      -> settings sections, customers and technicians (opened in the config area)
// Rows are filtered in JavaScript rather than with SQL LIKE so matching is case-insensitive on
// both SQLite and PostgreSQL. The data set is small (one company's jobs, or a few hundred rows).
import { prisma } from '../../db/prisma.js';
import { jobScope } from '../../lib/access.js';

const LIMIT_PER_GROUP = 6;
const MAX_ROWS = 2000;

const SETTINGS = [
  { key: 'pricing', title: 'Pricing', subtitle: 'Monthly plan prices and extra charges' },
  { key: 'plans', title: 'Plans', subtitle: 'Call-outs and hours included in each plan' },
  { key: 'rules', title: 'Service rules', subtitle: 'Toilet overflow notice and incident types' },
  { key: 'rewards', title: 'Reward rates', subtitle: 'Points per unit and when points unlock' }
];

const normalise = (v) => String(v ?? '').toLowerCase();
// Every word typed must appear somewhere in the record
const matcher = (q) => {
  const words = normalise(q).split(/\s+/).filter(Boolean);
  return (...fields) => {
    const hay = fields.map(normalise).join(' ');
    return words.every(w => hay.includes(w));
  };
};

const jobUrl = (role, id) => (role === 'CUSTOMER' ? `/app/requests/${id}` : role === 'TECHNICIAN' ? `/tech/jobs/${id}` : `/admin/jobs/${id}`);

export async function search(actor, rawQuery) {
  const q = String(rawQuery || '').trim().slice(0, 100);
  if (q.length < 2) return { query: q, results: [] };
  const hit = matcher(q);
  const role = actor.role;
  const results = [];

  if (role === 'CONFIG') {
    for (const s of SETTINGS) if (hit(s.title, s.subtitle)) results.push({ type: 'setting', id: s.key, title: s.title, subtitle: s.subtitle, url: `/settings/${s.key}` });
    if (hit('activity log history changes audit')) results.push({ type: 'setting', id: 'activity', title: 'Activity log', subtitle: 'Every add, edit and delete', url: '/settings/activity' });
    await addCustomersAndTechnicians(results, hit, '/settings');
    return { query: q, results };
  }

  // Jobs (requests)
  const jobs = await prisma.emergencyRequest.findMany({
    where: await jobScope(actor),
    select: {
      id: true, jobNumber: true, category: true, description: true, customerName: true, locationName: true,
      address: true, technicianName: true, onsiteContact: true, status: true, submittedAt: true
    },
    orderBy: { submittedAt: 'desc' },
    take: MAX_ROWS
  });
  jobs.filter(j => hit(j.jobNumber, j.category, j.description, j.customerName, j.locationName, j.address, j.technicianName, j.onsiteContact, j.status.replace(/_/g, ' ')))
    .slice(0, LIMIT_PER_GROUP)
    .forEach(j => results.push({
      type: 'job', id: j.id,
      title: `${j.jobNumber} · ${j.category}`,
      subtitle: [role === 'CUSTOMER' ? j.locationName : j.customerName, j.address].filter(Boolean).join(' · '),
      status: j.status,
      meta: role === 'ADMIN' ? (j.technicianName || 'Unassigned') : undefined,
      url: jobUrl(role, j.id)
    }));

  if (role === 'TECHNICIAN') return { query: q, results };

  // Sites
  const sites = await prisma.location.findMany({
    where: role === 'CUSTOMER' ? { organizationId: actor.organizationId || '__none__' } : {},
    include: { organization: { select: { businessName: true } } },
    take: MAX_ROWS
  });
  sites.filter(s => hit(s.name, s.address, s.contactName, s.contactPhone, s.organization?.businessName))
    .slice(0, LIMIT_PER_GROUP)
    .forEach(s => results.push({
      type: 'site', id: s.id, title: s.name,
      subtitle: role === 'CUSTOMER' ? s.address : `${s.organization?.businessName || ''} · ${s.address}`,
      url: role === 'CUSTOMER' ? '/app/account/sites' : `/admin/customers/${s.organizationId}`
    }));

  if (role !== 'ADMIN') return { query: q, results };

  await addCustomersAndTechnicians(results, hit, '/admin');
  return { query: q, results };
}

async function addCustomersAndTechnicians(results, hit, base) {
  // Customers
  const customers = await prisma.organization.findMany({ take: MAX_ROWS });
  customers.filter(c => hit(c.businessName, c.abn, c.primaryContactName, c.email, c.phoneNumber, c.membershipPlan))
    .slice(0, LIMIT_PER_GROUP)
    .forEach(c => results.push({
      type: 'customer', id: c.id, title: c.businessName,
      subtitle: [c.primaryContactName, c.email, c.phoneNumber].filter(Boolean).join(' · '),
      meta: c.subscriptionStatus === 'ACTIVE' ? undefined : c.subscriptionStatus.toLowerCase(),
      url: `${base}/customers/${c.id}`
    }));

  // Technicians
  const techs = await prisma.technician.findMany({ include: { user: { select: { email: true } } }, take: MAX_ROWS });
  techs.filter(t => hit(t.name, t.phone, t.user?.email))
    .slice(0, LIMIT_PER_GROUP)
    .forEach(t => results.push({
      type: 'technician', id: t.id, title: t.name,
      subtitle: [t.phone, t.user?.email].filter(Boolean).join(' · '),
      url: `${base}/technicians/${t.id}`
    }));
}
