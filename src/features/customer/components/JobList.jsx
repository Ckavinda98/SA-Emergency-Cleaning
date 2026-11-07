// Job list: a table on tablet/desktop, cards on phones. Rows open the job page.
import React from 'react';
import { useNavigate } from 'react-router-dom';
import { ChevronRight, MapPin, User } from 'lucide-react';
import { EmptyState } from '@/shared/ui/index.jsx';
import { StatusChip, formatDateTime, hasTech } from '@/shared/ui/jobs.jsx';

export function JobList({ jobs, linkTo, showCustomer = false, emptyTitle = 'No requests yet', emptyText, emptyAction, compact = false }) {
  const navigate = useNavigate();
  if (!jobs.length) return <EmptyState title={emptyTitle} action={emptyAction}>{emptyText}</EmptyState>;
  return (
    <>
      <table className="hidden w-full text-left text-sm md:table">
        <thead className="sticky top-0 z-[1] bg-white">
          <tr className="border-b border-slate-200 text-[11px] font-bold uppercase tracking-wide text-slate-500">
            <th className="py-2.5 pr-3 font-bold">Job</th>
            {showCustomer && <th className="py-2.5 pr-3 font-bold">Customer</th>}
            <th className="py-2.5 pr-3 font-bold">Incident & site</th>
            <th className="py-2.5 pr-3 font-bold">Status</th>
            {!compact && <th className="hidden py-2.5 pr-3 font-bold lg:table-cell">Technician</th>}
            {!compact && <th className="hidden py-2.5 pr-3 font-bold xl:table-cell">Submitted</th>}
            <th className="w-6" />
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {jobs.map(job => (
            <tr key={job.id} onClick={() => navigate(linkTo(job))} className="cursor-pointer hover:bg-slate-50">
              <td className="py-3 pr-3 align-top font-mono text-xs font-bold text-brand whitespace-nowrap">{job.jobNumber || job.id.slice(0, 8)}</td>
              {showCustomer && <td className="py-3 pr-3 align-top font-semibold text-slate-900">{job.customerName}</td>}
              <td className="py-3 pr-3 align-top">
                <div className="font-semibold text-slate-900">{job.category}</div>
                <div className="line-clamp-1 text-xs text-slate-500">{job.locationName}{job.address ? ` · ${job.address}` : ''}</div>
              </td>
              <td className="py-3 pr-3 align-top"><StatusChip status={job.status} /></td>
              {!compact && <td className="hidden py-3 pr-3 align-top text-xs font-medium text-slate-700 lg:table-cell">{hasTech(job) ? job.technicianName : <span className="text-slate-400">Not assigned</span>}</td>}
              {!compact && <td className="hidden py-3 pr-3 align-top text-xs text-slate-500 xl:table-cell whitespace-nowrap">{formatDateTime(job.submittedAt || job.createdAt)}</td>}
              <td className="py-3 align-top"><ChevronRight className="h-4 w-4 text-slate-300" /></td>
            </tr>
          ))}
        </tbody>
      </table>
      <ul className="space-y-2 md:hidden">
        {jobs.map(job => (
          <li key={job.id}>
            <button onClick={() => navigate(linkTo(job))} className="w-full rounded-xl border border-slate-200 bg-white p-3 text-left shadow-sm active:bg-slate-50 cursor-pointer">
              <div className="flex items-center justify-between gap-2">
                <span className="font-mono text-xs font-bold text-brand">{job.jobNumber || job.id.slice(0, 8)}</span>
                <StatusChip status={job.status} />
              </div>
              <div className="mt-1 text-sm font-semibold text-slate-900">{showCustomer ? `${job.customerName} · ` : ''}{job.category}</div>
              <div className="mt-0.5 flex items-center gap-1 text-xs text-slate-500"><MapPin className="h-3 w-3 shrink-0" /><span className="truncate">{job.locationName || job.address}</span></div>
              {hasTech(job) && <div className="mt-0.5 flex items-center gap-1 text-xs text-slate-500"><User className="h-3 w-3" />{job.technicianName}</div>}
            </button>
          </li>
        ))}
      </ul>
    </>
  );
}
