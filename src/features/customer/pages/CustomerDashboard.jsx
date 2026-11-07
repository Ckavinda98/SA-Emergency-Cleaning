// W3 Customer dashboard. On desktop it fits one screen: only the request list scrolls inside its card.
import React, { useState } from 'react';
import { ShieldCheck, Award, Clock, Siren, AlertTriangle, MapPin, Plus, IdCard } from 'lucide-react';
import { useCustomerSummary } from '@/app/AppData.jsx';
import { Page, Card, Kpi, Badge, Button, Tabs } from '@/shared/ui/index.jsx';
import { isFinished } from '@/shared/ui/jobs.jsx';
import { JobList } from '../components/JobList.jsx';
import { HotlineLink, LoyaltyBadge, fmtDate, fmtMoney } from '@/shared/ui/membership.jsx';

export function CustomerDashboard() {
  const s = useCustomerSummary();
  const { account, activePlan, config, membership: m } = s;
  const [tab, setTab] = useState('ongoing');
  if (!account) return null;
  const ongoing = s.customerJobs.filter(j => !isFinished(j.status));
  const past = s.customerJobs.filter(j => isFinished(j.status));

  return (
    <Page
      fit
      title={account.businessName}
      subtitle={`ABN ${account.abn || '—'} · ${account.primaryContactName || account.primaryContact || ''} · ${account.phoneNumber || account.phone || ''}`}
      actions={<>
        <Badge tone={s.cancelled || s.suspended ? 'danger' : 'success'}>{s.cancelled ? 'Membership cancelled' : s.suspended ? 'Membership suspended' : 'Active membership'}</Badge>
        {!s.cancelled && <LoyaltyBadge level={m.loyaltyLevel} />}
        {account.membershipNumber && <Badge tone="slate">No. {account.membershipNumber}</Badge>}
        {account.paymentMethod && <Badge tone="slate">Payment: {account.paymentMethod}</Badge>}
      </>}
    >
      {/* Mobile: emergency action first */}
      <div className="mb-4 md:hidden"><EmergencyCard s={s} /></div>

      <div className="grid shrink-0 grid-cols-2 gap-3 md:grid-cols-3 md:gap-4">
        <Kpi className="col-span-2 md:col-span-1" label="Membership" value={`${activePlan?.name} plan`} icon={ShieldCheck}
          sub={`${fmtMoney(m.fee?.monthly ?? activePlan?.price)}/mo + GST · ${m.serviceWindow || ''}`}
          to="/app/membership" title="Open your membership: plan, price and billing" />
        <Kpi label="Call-outs left" value={`${s.remaining} / ${s.included}`} icon={Clock} tone={s.exhausted ? 'warning' : 'success'}
          sub={<span className="block"><span className="mb-1 block h-1.5 w-full overflow-hidden rounded-full bg-slate-100"><span className={`block h-full rounded-full ${s.exhausted ? 'bg-amber-500' : 'bg-emerald-500'}`} style={{ width: `${(s.remaining / (s.included || 1)) * 100}%` }} /></span>Resets in {m.daysUntilReset ?? '–'} day{m.daysUntilReset === 1 ? '' : 's'} (1st of the month)</span>}
          to="/app/membership#callouts" title="See how call-outs work and how many you have used" />
        <Kpi label="Reward points" value={`${account.pointsBalance ?? 0} pts`} icon={Award} tone="rewards"
          sub={s.tenureUnlocked ? '1 point = $1 off periodical services' : `Usable from ${fmtDate(m.redeemUnlocksOn)}`}
          to="/app/rewards" title="Open reward points to redeem them for free cleaning" />
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-[minmax(280px,1fr)_2fr] fit:min-h-0 fit:flex-1 fit:grid-rows-[minmax(0,1fr)]">
        <div className="flex min-h-0 flex-col gap-4">
          <div className="hidden md:block"><EmergencyCard s={s} /></div>
          {m.inWaitingPeriod && !s.cancelled && (
            <Card tone="warning" title="Waiting period" icon={Clock}>
              <p className="text-sm text-amber-900">Included call-outs start on {fmtDate(m.waitingPeriodEnds)} (day 11). We can still attend before then: a one-off {fmtMoney(config.earlyActivationFee)} + GST early activation fee applies.</p>
            </Card>
          )}
          <Card title="Membership card" icon={IdCard} actions={<Button to="/app/membership/card" variant="secondary" size="sm">Open</Button>}>
            <p className="text-sm text-slate-600">Your membership number, level and the 24/7 hotline: <HotlineLink /></p>
          </Card>
          <Card title={`Your sites (${(account.locations || []).length})`} icon={MapPin} className="fit:min-h-0 fit:flex-1" bodyClassName="fit:overflow-y-auto"
            actions={<Button title="Add or edit your service sites" to="/app/account/sites" variant="ghost" size="sm">Manage</Button>}>
            <ul className="space-y-2">
              {(account.locations || []).map(l => (
                <li key={l.id} className="rounded-xl border border-slate-100 bg-slate-50 p-2.5">
                  <div className="text-sm font-semibold text-slate-900">{l.name}</div>
                  <div className="text-xs text-slate-500">{l.address}</div>
                </li>
              ))}
            </ul>
          </Card>
        </div>

        <Card
          title="Emergency requests"
          icon={Clock}
          className="fit:min-h-0"
          bodyClassName="fit:flex-1 fit:overflow-y-auto"
          actions={<>
            <Tabs value={tab} onChange={setTab} tabs={[{ key: 'ongoing', label: 'Ongoing', count: ongoing.length }, { key: 'past', label: 'Past', count: past.length }]} />
            <Button title="See all your requests" to="/app/requests" variant="ghost" size="sm">View all</Button>
          </>}
        >
          <JobList
            jobs={tab === 'ongoing' ? ongoing : past}
            linkTo={j => `/app/requests/${j.id}`}
            compact
            emptyTitle={tab === 'ongoing' ? 'No ongoing requests' : 'No past requests yet'}
            emptyText={tab === 'ongoing' ? 'When something happens on site, raise a request or call the hotline. We aim to attend within 2–4 hours of acknowledging it.' : undefined}
            emptyAction={tab === 'ongoing' && !s.cancelled ? <Button title="Request emergency cleaning" to="/app/requests/new" size="sm" icon={Plus}>New request</Button> : null}
          />
        </Card>
      </div>
    </Page>
  );
}

function EmergencyCard({ s }) {
  if (s.cancelled) {
    return (
      <Card tone="danger" title="Membership cancelled" icon={AlertTriangle}>
        <p className="text-sm text-red-800">Membership benefits have ended. Call <HotlineLink /> to rejoin.</p>
        <Button title="Pick a membership plan" to="/app/membership/change" className="mt-3" block>Choose a plan</Button>
      </Card>
    );
  }
  if (s.exhausted) {
    return (
      <Card tone="warning" title="All call-outs used this month" icon={AlertTriangle}>
        <p className="text-sm text-amber-900">You can still request help. Each extra call-out is {fmtMoney(s.membership.additionalCalloutFee ?? s.config.additionalCalloutFee)} + GST and still includes the first hour; labour after that is {fmtMoney(s.labourRate)}/hr + GST.</p>
        <div className="mt-3 grid gap-2 sm:grid-cols-2">
          <Button title="Send a request now. Extra call-out charges apply." to="/app/requests/new" variant="emergency" icon={Siren}>Request anyway</Button>
          <Button title="Move to a plan with more call-outs" to="/app/membership/change" variant="secondary">Upgrade plan</Button>
        </div>
      </Card>
    );
  }
  return (
    <div className="rounded-2xl bg-gradient-to-br from-brand-dark to-brand p-5 text-white shadow-sm">
      <div className="flex items-center gap-3">
        <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-white/15"><Siren className="h-6 w-6 text-amber-300" /></span>
        <div>
          <h2 className="text-lg font-extrabold leading-tight">Need emergency help?</h2>
          <p className="text-xs text-sky-100">2–4 hours from when we acknowledge your request · 24/7 hotline <HotlineLink light className="text-xs" /></p>
        </div>
      </div>
      <Button title="Tell us about an emergency. We aim to be on site within 2–4 hours." to="/app/requests/new" variant="white" size="lg" block className="mt-4">Request emergency cleaning</Button>
    </div>
  );
}
