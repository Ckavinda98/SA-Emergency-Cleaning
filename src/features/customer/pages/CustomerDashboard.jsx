// W3 Customer dashboard. On desktop it fits one screen: only the request list scrolls inside its card.
import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { ShieldCheck, Award, Clock, Siren, AlertTriangle, MapPin, Plus, Info } from 'lucide-react';
import { useCustomerSummary } from '@/app/AppData.jsx';
import { Page, Card, Kpi, Badge, Button, Tabs } from '@/shared/ui/index.jsx';
import { isFinished } from '@/shared/ui/jobs.jsx';
import { JobList } from '../components/JobList.jsx';

export function CustomerDashboard() {
  const s = useCustomerSummary();
  const { account, activePlan, config } = s;
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
        <Badge tone={s.cancelled ? 'danger' : 'success'}>{s.cancelled ? 'Membership cancelled' : 'Active membership'}</Badge>
        {account.paymentMethod && <Badge tone="slate">Payment: {account.paymentMethod}</Badge>}
      </>}
    >
      {/* Mobile: emergency action first */}
      <div className="mb-4 md:hidden"><EmergencyCard s={s} /></div>

      <div className="grid shrink-0 grid-cols-2 gap-3 md:grid-cols-3 md:gap-4">
        <Kpi className="col-span-2 md:col-span-1" label="Membership" value={`${activePlan?.name} plan`} icon={ShieldCheck}
          sub={`$${activePlan?.price}/mo · ${activePlan?.callouts} call-outs included`}
          action={<Link to="/app/membership" className="font-semibold text-brand hover:underline">Manage</Link>} />
        <Kpi label="Call-outs left" value={`${s.remaining} / ${s.included}`} icon={Clock} tone={s.exhausted ? 'warning' : 'success'}
          sub={<span className="block"><span className="mb-1 block h-1.5 w-full overflow-hidden rounded-full bg-slate-100"><span className={`block h-full rounded-full ${s.exhausted ? 'bg-amber-500' : 'bg-emerald-500'}`} style={{ width: `${(s.remaining / (s.included || 1)) * 100}%` }} /></span>Resets in 12 days</span>}
          action={<Link to="/app/membership#callouts" className="inline-flex items-center gap-1 font-semibold text-brand hover:underline"><Info className="h-3 w-3" />How it works</Link>} />
        <Kpi label="Reward points" value={`${account.pointsBalance ?? 0} pts`} icon={Award} tone="rewards"
          sub={s.tenureUnlocked ? 'Redemptions unlocked' : `Unlocks after ${config.tenureMinMonths} months`}
          action={<Link to="/app/rewards" className="font-semibold text-purple-700 hover:underline">Redeem</Link>} />
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-[minmax(280px,1fr)_2fr] fit:min-h-0 fit:flex-1 fit:grid-rows-[minmax(0,1fr)]">
        <div className="flex min-h-0 flex-col gap-4">
          <div className="hidden md:block"><EmergencyCard s={s} /></div>
          <Card title="Rewards catalog" icon={Award} actions={<Button to="/app/rewards" variant="secondary" size="sm">Open</Button>}>
            <p className="text-sm text-slate-600">Use your points for free periodic cleaning: steam cleaning, pressure washing, tile & grout, deep cleaning and high dusting.</p>
          </Card>
          <Card title={`Your sites (${(account.locations || []).length})`} icon={MapPin} className="fit:min-h-0 fit:flex-1" bodyClassName="fit:overflow-y-auto"
            actions={<Button to="/app/account/sites" variant="ghost" size="sm">Manage</Button>}>
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
            <Button to="/app/requests" variant="ghost" size="sm">View all</Button>
          </>}
        >
          <JobList
            jobs={tab === 'ongoing' ? ongoing : past}
            linkTo={j => `/app/requests/${j.id}`}
            compact
            emptyTitle={tab === 'ongoing' ? 'No ongoing requests' : 'No past requests yet'}
            emptyText={tab === 'ongoing' ? 'When something happens on site, raise a request and we aim to attend within 2–4 hours.' : undefined}
            emptyAction={tab === 'ongoing' && !s.exhausted ? <Button to="/app/requests/new" size="sm" icon={Plus}>New request</Button> : null}
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
        <p className="text-sm text-red-800">Priority 2–4 hour attendance is switched off. Choose a plan to restart it.</p>
        <Button to="/app/membership/change" className="mt-3" block>Choose a plan</Button>
      </Card>
    );
  }
  if (s.exhausted) {
    return (
      <Card tone="warning" title="All call-outs used this month" icon={AlertTriangle}>
        <p className="text-sm text-amber-900">You can still request help. Extra call-outs cost ${s.config.additionalCalloutFee} plus ${s.config.overageHourlyRate}/hr, or upgrade your plan.</p>
        <div className="mt-3 grid gap-2 sm:grid-cols-2">
          <Button to="/app/requests/new" variant="emergency" icon={Siren}>Request anyway</Button>
          <Button to="/app/membership/change" variant="secondary">Upgrade plan</Button>
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
          <p className="text-xs text-sky-100">2–4 hour target attendance · 24/7 response desk</p>
        </div>
      </div>
      <Button to="/app/requests/new" variant="white" size="lg" block className="mt-4">Request emergency cleaning</Button>
    </div>
  );
}
