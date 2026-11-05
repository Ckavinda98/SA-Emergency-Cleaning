import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  console.log('Seeding SA Commercial Cleaning Database...');
  const hashedPassword = await bcrypt.hash('Password123!', 10);

  // 1. Seed Dynamic System Config
  const defaultConfig = {
    membershipPlans: [
      { id: 'essential', name: 'Essential', price: 99, callouts: 1, hoursPerCallout: 1 },
      { id: 'business', name: 'Business', price: 199, callouts: 2, hoursPerCallout: 1 },
      { id: 'premium', name: 'Premium', price: 399, callouts: 4, hoursPerCallout: 1 }
    ],
    additionalCalloutFee: 30,
    overageHourlyRate: 120,
    toiletOverflowDisclaimer: "Cleaning of the affected area and surrounding surfaces only. SA Commercial Cleaning Services Pty Ltd does not provide plumbing, blockage removal, drain clearing or toilet unclogging services.",
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
      consecutiveMonths: 8,
      pointsBalance: 1592,
      calloutsUsed: 0,
      locations: {
        create: [
          {
            id: 'loc-1',
            name: 'Adelaide CBD Headquarters',
            address: '120 Grenfell Street, Adelaide SA 5000',
            contactName: 'Sarah Jenkins',
            contactPhone: '0433 111 222',
            accessInstructions: 'Keypad Code #4829 on Rear Service Door after 6 PM',
            securityNotes: 'Security Guard on site 24/7. Check in at reception desk.'
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
      consecutiveMonths: 12,
      pointsBalance: 3192,
      calloutsUsed: 1,
      locations: {
        create: [
          {
            id: 'loc-3',
            name: 'King William Street Tower',
            address: '80 King William Street, Adelaide SA 5000',
            contactName: 'David Ross',
            contactPhone: '0418 987 654',
            accessInstructions: 'Security Desk Master Key Card #04',
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
      category: 'Toilet Overflow',
      description: 'Executive rest room toilet overflowed onto hallway carpet tiles.',
      affectedArea: 25,
      onsiteContact: 'Sarah Jenkins',
      onsitePhone: '0433 111 222',
      accessInstructions: 'Keypad Code #4829 on Rear Service Door',
      status: 'IN_PROGRESS',
      submittedAt: new Date(Date.now() - 45 * 60000),
      targetAttendanceAt: new Date(Date.now() + 75 * 60000),
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
      category: 'Water Ingress & Extraction',
      description: 'Roof leak during heavy storm causing standing water in loading bay B.',
      affectedArea: 60,
      onsiteContact: 'Mark Vance',
      onsitePhone: '0422 999 888',
      accessInstructions: 'Gate 3 Lockbox 1928',
      status: 'COMPLETED',
      submittedAt: new Date(Date.now() - 7 * 24 * 3600 * 1000),
      technicianName: 'Dave Miller (Tech ID #104)',
      photosJson: JSON.stringify([
        'https://images.unsplash.com/photo-1527515637462-cff94eecc1ac?auto=format&fit=crop&w=600&q=80'
      ]),
      timerMinutes: 0,
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
      description: 'Monthly Business Membership Subscription ($199/mo)',
      amount: 199.00,
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
      description: 'Monthly Premium Membership Subscription ($399/mo)',
      amount: 399.00,
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
      serviceName: 'Carpet Steam Cleaning',
      quantity: 50,
      calculatedPoints: 250,
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
