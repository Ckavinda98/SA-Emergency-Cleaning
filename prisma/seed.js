import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';
import { DEFAULT_CONFIG } from '../shared/config.js';

const monthsAgo = (n) => { const d = new Date(); d.setMonth(d.getMonth() - n); return d; };
const lockedRates = () => JSON.stringify(Object.fromEntries(DEFAULT_CONFIG.membershipPlans.map(p => [p.id, { labourRate: p.labourRate, additionalCalloutFee: DEFAULT_CONFIG.additionalCalloutFee, price: p.price }])));
const nextYearFrom = (start) => { const d = new Date(start); while (d <= new Date()) d.setFullYear(d.getFullYear() + 1); return d; };

// SACC_DB_URL lets the automated tests seed their own database (prisma/test.db)
const prisma = process.env.SACC_DB_URL
  ? new PrismaClient({ datasources: { db: { url: process.env.SACC_DB_URL } } })
  : new PrismaClient();

async function main() {
  console.log('Seeding SA Commercial Cleaning Database...');
  const hashedPassword = await bcrypt.hash('Password123!', 10);

  // 1. Seed Dynamic System Config
  // Plans, fees and rules from the client's Membership Agreement v1.0 (shared/config.js)
  const defaultConfig = DEFAULT_CONFIG;

  await prisma.systemDynamicConfig.upsert({
    where: { configKey: 'MAIN_CONFIG' },
    update: { configValue: JSON.stringify(defaultConfig) },
    create: { configKey: 'MAIN_CONFIG', configValue: JSON.stringify(defaultConfig) }
  });

  // 2. Seed Customer Accounts & Locations
  const cust1 = await prisma.organization.upsert({
    where: { email: 'mahima@mahimaenterprises.com.au' },
    update: {},
    create: {
      id: 'cust-1',
      businessName: 'Mahima Commercial Enterprises Pty Ltd',
      abn: '48 123 456 789',
      primaryContactName: 'Mahima Sharma',
      phoneNumber: '0412 345 678',
      email: 'mahima@mahimaenterprises.com.au',
      membershipPlan: 'business',
      paymentMethod: 'PayTo Bank Direct',
      paymentType: 'DIRECT_DEBIT',
      subscriptionStatus: 'ACTIVE',
      consecutiveMonths: 0,
      pointsBalance: 0,
      calloutsUsed: 1,
      lastCalloutAt: new Date(Date.now() - 40 * 60000),
      activationDate: monthsAgo(8),
      membershipNumber: 'SACC-M01001',
      referralCode: 'REF-MAHIMA',
      lockedRatesJson: lockedRates(),
      ratesLockedUntil: nextYearFrom(monthsAgo(8)),
      locations: {
        create: [
          {
            id: 'loc-1',
            name: 'Adelaide CBD Headquarters',
            address: '120 Grenfell Street, Adelaide SA 5000',
            contactName: 'Sarah Jenkins',
            contactPhone: '0433 111 222',
            accessInstructions: 'Keypad Code #4829 on Rear Service Door after 6 PM',
            securityNotes: 'Security Guard on site 24/7. Check in at reception desk.',
            calloutsUsed: 1
          },
          {
            id: 'loc-2',
            name: 'Port Adelaide Distribution Hub',
            address: '45 Ocean Steamers Road, Port Adelaide SA 5015',
            contactName: 'Mark Vance',
            contactPhone: '0422 999 888',
            accessInstructions: 'Gate 3 Lockbox 1928. Key card inside.',
            securityNotes: 'Hi-Vis vest & steel cap boots required in warehouse.'
          }
        ]
      }
    }
  });

  await prisma.user.upsert({
    where: { email: 'mahima@mahimaenterprises.com.au' },
    update: {},
    create: {
      email: 'mahima@mahimaenterprises.com.au',
      password: hashedPassword,
      name: 'Mahima Sharma',
      role: 'CUSTOMER',
      organizationId: 'cust-1'
    }
  });

  const cust2 = await prisma.organization.upsert({
    where: { email: 'dross@adelaidetower.com.au' },
    update: {},
    create: {
      id: 'cust-2',
      businessName: 'Adelaide Corporate Tower Management',
      abn: '99 876 543 210',
      primaryContactName: 'David Ross',
      phoneNumber: '0418 987 654',
      email: 'dross@adelaidetower.com.au',
      membershipPlan: 'premium',
      paymentMethod: 'PayTo Bank Direct',
      paymentType: 'DIRECT_DEBIT',
      subscriptionStatus: 'ACTIVE',
      consecutiveMonths: 0,
      pointsBalance: 0,
      calloutsUsed: 1,
      activationDate: monthsAgo(13),
      membershipNumber: 'SACC-M01002',
      referralCode: 'REF-ADLTWR',
      lockedRatesJson: lockedRates(),
      ratesLockedUntil: nextYearFrom(monthsAgo(13)),
      locations: {
        create: [
          {
            id: 'loc-3',
            name: 'King William Street Tower',
            address: '80 King William Street, Adelaide SA 5000',
            contactName: 'David Ross',
            contactPhone: '0418 987 654',
            accessInstructions: 'Security Desk Master Key Card #04',
            calloutsUsed: 1,
            securityNotes: 'After hours swipe card required at lift lobby.'
          }
        ]
      }
    }
  });

  await prisma.user.upsert({
    where: { email: 'dross@adelaidetower.com.au' },
    update: {},
    create: {
      email: 'dross@adelaidetower.com.au',
      password: hashedPassword,
      name: 'David Ross',
      role: 'CUSTOMER',
      organizationId: 'cust-2'
    }
  });

  // Opening reward points balances (ledger, cl. 14), earned last month so they expire in 11 months
  for (const [orgId, points] of [['cust-1', 1592], ['cust-2', 3192]]) {
    const has = await prisma.pointsEntry.findFirst({ where: { organizationId: orgId } });
    if (!has) {
      await prisma.pointsEntry.create({ data: { organizationId: orgId, points, remaining: points, reason: 'OPENING', note: 'Opening balance', createdAt: monthsAgo(1), expiresAt: monthsAgo(-11) } });
      await prisma.organization.update({ where: { id: orgId }, data: { pointsBalance: points } });
    }
  }

  // 3. Seed Technicians
  await prisma.technician.upsert({
    where: { id: 'tech-1' },
    update: {},
    create: { id: 'tech-1', name: 'Dave Miller', phone: '0488 111 222', status: 'ON_SITE', activeJobId: 'SACC-2026-0812', rating: 4.9 }
  });
  await prisma.user.upsert({
    where: { email: 'dave@sacleaning.com.au' },
    update: {},
    create: {
      email: 'dave@sacleaning.com.au',
      password: hashedPassword,
      name: 'Dave Miller',
      role: 'TECHNICIAN',
      technicianId: 'tech-1'
    }
  });

  await prisma.technician.upsert({
    where: { id: 'tech-2' },
    update: {},
    create: { id: 'tech-2', name: 'Chris Watson', phone: '0477 333 444', status: 'AVAILABLE', activeJobId: null, rating: 5.0 }
  });
  await prisma.user.upsert({
    where: { email: 'chris@sacleaning.com.au' },
    update: {},
    create: {
      email: 'chris@sacleaning.com.au',
      password: hashedPassword,
      name: 'Chris Watson',
      role: 'TECHNICIAN',
      technicianId: 'tech-2'
    }
  });

  // 3.5 Seed Admin & Config Users
  await prisma.user.upsert({
    where: { email: 'admin@sacleaning.com.au' },
    update: {},
    create: {
      email: 'admin@sacleaning.com.au',
      password: hashedPassword,
      name: 'Sarah Connor',
      role: 'ADMIN'
    }
  });

  await prisma.user.upsert({
    where: { email: 'config@sacleaning.com.au' },
    update: {},
    create: {
      email: 'config@sacleaning.com.au',
      password: hashedPassword,
      name: 'Alex Vance',
      role: 'CONFIG'
    }
  });

  // 4. Seed Initial Active Job
  await prisma.emergencyRequest.upsert({
    where: { jobNumber: 'SACC-2026-0812' },
    update: {},
    create: {
      id: 'job-1',
      jobNumber: 'SACC-2026-0812',
      organizationId: 'cust-1',
      locationId: 'loc-1',
      customerName: 'Mahima Commercial Enterprises Pty Ltd',
      locationName: 'Adelaide CBD Headquarters',
      address: '120 Grenfell Street, Adelaide SA 5000',
      category: 'Toilet overflow',
      description: 'Executive rest room toilet overflowed onto hallway carpet tiles.',
      affectedArea: 6,
      waterType: 'BLACK',
      planAtBooking: 'business',
      priorityTier: 2,
      acknowledgedAt: new Date(Date.now() - 42 * 60000),
      responseClockStartAt: new Date(Date.now() - 42 * 60000),
      targetWindowFrom: new Date(Date.now() + 78 * 60000),
      triage: 'COVERED',
      triagedAt: new Date(Date.now() - 40 * 60000),
      calloutType: 'INCLUDED',
      measuredArea: 6,
      beforePhotosJson: JSON.stringify(['https://images.unsplash.com/photo-1584622650111-993a426fbf0a?auto=format&fit=crop&w=600&q=80']),
      workStartedAt: new Date(Date.now() - 20 * 60000),
      onsiteContact: 'Sarah Jenkins',
      onsitePhone: '0433 111 222',
      accessInstructions: 'Keypad Code #4829 on Rear Service Door',
      status: 'IN_PROGRESS',
      submittedAt: new Date(Date.now() - 45 * 60000),
      targetAttendanceAt: new Date(Date.now() + 198 * 60000),
      technicianName: 'Dave Miller (Tech ID #104)',
      photosJson: JSON.stringify([
        'https://images.unsplash.com/photo-1584622650111-993a426fbf0a?auto=format&fit=crop&w=600&q=80',
        'https://images.unsplash.com/photo-1527515637462-cff94eecc1ac?auto=format&fit=crop&w=600&q=80'
      ]),
      timerMinutes: 48,
      timerActive: true
    }
  });

  await prisma.emergencyRequest.upsert({
    where: { jobNumber: 'SACC-2026-0798' },
    update: {},
    create: {
      id: 'job-2',
      jobNumber: 'SACC-2026-0798',
      organizationId: 'cust-1',
      locationId: 'loc-2',
      customerName: 'Mahima Commercial Enterprises Pty Ltd',
      locationName: 'Port Adelaide Distribution Hub',
      address: '45 Ocean Steamers Road, Port Adelaide SA 5015',
      category: 'Burst pipe or water leak',
      description: 'Burst pipe in loading bay B: standing clean water near the roller door.',
      affectedArea: 8,
      waterType: 'CLEAN',
      planAtBooking: 'business',
      priorityTier: 2,
      acknowledgedAt: new Date(Date.now() - 7 * 24 * 3600 * 1000 + 5 * 60000),
      responseClockStartAt: new Date(Date.now() - 7 * 24 * 3600 * 1000 + 5 * 60000),
      targetAttendanceAt: new Date(Date.now() - 7 * 24 * 3600 * 1000 + 245 * 60000),
      triage: 'COVERED',
      calloutType: 'INCLUDED',
      completedAt: new Date(Date.now() - 7 * 24 * 3600 * 1000 + 4 * 3600 * 1000),
      workStartedAt: new Date(Date.now() - 7 * 24 * 3600 * 1000 + 150 * 60000),
      measuredArea: 8,
      siteRepName: 'Mark Vance',
      signedOffAt: new Date(Date.now() - 7 * 24 * 3600 * 1000 + 4 * 3600 * 1000),
      onsiteContact: 'Mark Vance',
      onsitePhone: '0422 999 888',
      accessInstructions: 'Gate 3 Lockbox 1928',
      status: 'COMPLETED',
      submittedAt: new Date(Date.now() - 7 * 24 * 3600 * 1000),
      technicianName: 'Dave Miller (Tech ID #104)',
      photosJson: JSON.stringify([
        'https://images.unsplash.com/photo-1527515637462-cff94eecc1ac?auto=format&fit=crop&w=600&q=80'
      ]),
      timerMinutes: 90,
      timerActive: false
    }
  });

  // 5. Seed Invoices
  await prisma.invoice.upsert({
    where: { invoiceNumber: 'INV-2026-0801' },
    update: {},
    create: {
      id: 'inv-1',
      invoiceNumber: 'INV-2026-0801',
      organizationId: 'cust-1',
      description: 'Business membership, monthly fee',
      kind: 'MEMBERSHIP',
      amount: 199.00,
      gst: 19.90,
      status: 'PAID',
      paymentMethod: 'PayTo Bank Direct',
      dueDate: new Date(Date.now() - 10 * 86400000),
      paidAt: new Date(Date.now() - 10 * 86400000)
    }
  });

  await prisma.invoice.upsert({
    where: { invoiceNumber: 'INV-2026-0802' },
    update: {},
    create: {
      id: 'inv-2',
      invoiceNumber: 'INV-2026-0802',
      organizationId: 'cust-2',
      description: 'Premium membership, monthly fee',
      kind: 'MEMBERSHIP',
      amount: 399.00,
      gst: 39.90,
      status: 'PAID',
      paymentMethod: 'PayTo Bank Direct',
      dueDate: new Date(Date.now() - 5 * 86400000),
      paidAt: new Date(Date.now() - 5 * 86400000)
    }
  });

  // 6. Seed Sample Redemption Requests
  await prisma.redemptionRequest.upsert({
    where: { id: 'red-1' },
    update: {},
    create: {
      id: 'red-1',
      organizationId: 'cust-1',
      locationId: 'loc-1',
      serviceCode: 'carpet_steam',
      serviceName: 'Carpet steam cleaning',
      quantity: 50,
      notes: 'Boardroom and reception, about 50 m²',
      calculatedPoints: 0,
      status: 'PENDING_APPROVAL'
    }
  });

  console.log('✅ Database Seeding Completed Cleanly!');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
