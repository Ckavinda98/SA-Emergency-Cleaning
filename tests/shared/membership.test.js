// The Agreement rules in shared/membership.js (clause numbers from Membership Agreement & Terms v1.0)
import { describe, it, expect } from 'vitest';
import { DEFAULT_CONFIG, planFor, withDefaults } from '../../shared/config.js';
import {
  billableLabourHours, jobCharges, surchargeFor, responseTarget, inWaitingPeriod, coverageWarnings,
  loyaltyLevel, membershipFee, multiSiteDiscount, serviceArea, proRata, daysUntilMonthlyReset, addMonths
} from '../../shared/membership.js';

const plan = (id) => planFor(DEFAULT_CONFIG, id);
// Adelaide is UTC+10:30 in summer: 2026-11-07 22:30 Adelaide = 2026-11-07 12:00Z
const adl = (iso) => new Date(iso);

describe('plans (cl. 2)', () => {
  it('has per-plan labour rates and call-outs', () => {
    expect(['essential', 'business', 'premium'].map(id => plan(id).labourRate)).toEqual([95, 90, 85]);
    expect(['essential', 'business', 'premium'].map(id => plan(id).callouts)).toEqual([1, 2, 4]);
  });
  it('fills in new rules over settings saved before the documents', () => {
    const merged = withDefaults({ membershipPlans: [{ id: 'business', price: 199 }], overageHourlyRate: 120, incidentCategories: ['Oil or grease spill'] });
    expect(merged.membershipPlans[0].labourRate).toBe(90);
    expect(merged.overageHourlyRate).toBeUndefined();
    expect(merged.incidentCategories).toContain('Slip hazard');
  });
});

describe('labour (cl. 8.2, 8.3)', () => {
  it('includes the first technician hour and bills whole hours after it', () => {
    expect(billableLabourHours(60, 1)).toBe(0);
    expect(billableLabourHours(61, 1)).toBe(1);
    expect(billableLabourHours(150, 1)).toBe(2);
    expect(billableLabourHours(30, 2)).toBe(0); // two technicians for 30 minutes use the included hour
    expect(billableLabourHours(70, 2)).toBe(2);
  });
});

describe('surcharges (cl. 7)', () => {
  it('charges one $50 after hours or on a public holiday, never for Premium', () => {
    const night = adl('2026-11-07T12:00:00Z'); // 10:30 pm in Adelaide
    expect(surchargeFor(plan('business'), night).amount).toBe(50);
    expect(surchargeFor(plan('premium'), night).amount).toBe(0);
    const xmasNight = adl('2026-12-25T12:00:00Z');
    expect(surchargeFor(plan('business'), xmasNight).amount).toBe(50); // only one surcharge
    const day = adl('2026-11-09T01:00:00Z'); // Monday 11:30 am
    expect(surchargeFor(plan('essential'), day).amount).toBe(0);
  });
});

describe('response clock (cl. 13)', () => {
  it('runs from acknowledgment, and from 6 am for Essential after hours', () => {
    const ack = adl('2026-11-09T01:00:00Z'); // 11:30 am
    expect(responseTarget(plan('business'), ack).to - ack).toBe(4 * 3600000);
    const late = adl('2026-11-07T12:00:00Z'); // 10:30 pm
    const t = responseTarget(plan('essential'), late);
    expect(new Intl.DateTimeFormat('en-AU', { timeZone: 'Australia/Adelaide', hour: 'numeric', hourCycle: 'h23' }).format(t.clockStart)).toBe('06');
    expect(responseTarget(plan('business'), late).clockStart).toEqual(late);
  });
});

describe('waiting period (cl. 3)', () => {
  it('covers days 1 to 10', () => {
    const start = new Date('2026-11-01T00:00:00Z');
    expect(inWaitingPeriod(start, new Date('2026-11-10T12:00:00Z'))).toBe(true);
    expect(inWaitingPeriod(start, new Date('2026-11-11T12:00:00Z'))).toBe(false);
  });
});

describe('charges', () => {
  it('adds the $30 additional call-out, labour at the plan rate, surcharge, disposal and travel', () => {
    const job = { calloutType: 'ADDITIONAL', timerMinutes: 100, technicianCount: 1, surchargeAmount: 50, disposalJson: JSON.stringify([{ item: 'Glass', cost: 10 }]), travelKm: 20 };
    const c = jobCharges(job, plan('essential'), DEFAULT_CONFIG);
    const by = Object.fromEntries(c.lines.map(l => [l.code, l.amount]));
    expect(by).toMatchObject({ ADDITIONAL_CALLOUT: 30, LABOUR: 95, SURCHARGE: 50, DISPOSAL: 10, DISPOSAL_HANDLING: 25, TRAVEL: 60 });
    expect(c.subtotal).toBe(270);
    expect(c.gst).toBe(27);
  });
  it('charges no labour for quoted work, and $100 for missed access', () => {
    expect(jobCharges({ triage: 'SPECIALIST', timerMinutes: 200 }, plan('business'), DEFAULT_CONFIG).subtotal).toBe(0);
    expect(jobCharges({ calloutType: 'INCLUDED', missedAccessAt: new Date() }, plan('business'), DEFAULT_CONFIG).subtotal).toBe(100);
  });
});

describe('coverage (cl. 9, 10)', () => {
  it('flags grey water and areas over the limits', () => {
    expect(coverageWarnings({ category: 'Wet carpet', affectedArea: 12, waterType: 'CLEAN' })).toHaveLength(1);
    expect(coverageWarnings({ category: 'Wet carpet', affectedArea: 8, waterType: 'CLEAN' })).toHaveLength(0);
    expect(coverageWarnings({ category: 'Spill clean-up', waterType: 'BLACK' })).toHaveLength(1);
    expect(coverageWarnings({ category: 'Minor graffiti', affectedArea: 3 })).toHaveLength(1);
  });
});

describe('loyalty, fees, area (cl. 15, 17, 18, 5.3)', () => {
  it('works out loyalty levels', () => {
    const now = new Date('2026-11-07');
    expect(loyaltyLevel(addMonths(now, -11), now)).toBe(null);
    expect(loyaltyLevel(addMonths(now, -12), now).name).toBe('Bronze');
    expect(loyaltyLevel(addMonths(now, -40), now).name).toBe('Silver');
    expect(loyaltyLevel(addMonths(now, -61), now).name).toBe('Gold');
  });
  it('discounts fees for 2 or more sites', () => {
    expect(multiSiteDiscount(1).percent).toBe(0);
    expect(multiSiteDiscount(3).percent).toBe(10);
    expect(multiSiteDiscount(7).percent).toBe(15);
    expect(multiSiteDiscount(12).custom).toBe(true);
    expect(membershipFee(['business', 'business']).monthly).toBe(358.2);
  });
  it('knows the Adelaide metro area', () => {
    expect(serviceArea('120 Grenfell Street, Adelaide SA 5000')).toBe('METRO');
    expect(serviceArea('1 Murray St, Gawler SA 5118')).toBe('OUTSIDE_METRO');
    expect(serviceArea('2 Main St, Mount Barker SA 5251')).toBe('OUTSIDE_METRO');
    expect(serviceArea('1 George St, Sydney NSW 2000')).toBe('OUTSIDE_SA');
  });
  it('refunds the unused part of a period', () => {
    expect(proRata(300, new Date('2026-11-01'), new Date('2026-12-01'), new Date('2026-11-16'))).toBe(150);
  });
  it('counts days until the 1st', () => {
    expect(daysUntilMonthlyReset(new Date('2026-11-07T02:00:00Z'))).toBe(24);
  });
});
