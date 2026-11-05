import React, { useState, useEffect, useRef } from 'react';
import { Preferences } from '@capacitor/preferences';
import { 
  ShieldAlert, Phone, Clock, MapPin, AlertTriangle, FileText, Award, 
  CheckCircle2, PlusCircle, User, Building, Wrench, Settings, ArrowRight, 
  UploadCloud, AlertCircle, Play, Check, X, Shield, RefreshCw, Send, 
  DollarSign, ChevronRight, Camera, FileCheck, PhoneCall, ExternalLink,
  Users, BarChart3, Edit3, Trash2, Search, Filter, ShieldCheck, CheckSquare, Plus, ChevronDown, Zap, Download,
  Menu, LogOut
} from 'lucide-react';

const API_BASE = 'http://localhost:5000/api';
const IS_DEV = Boolean(import.meta.env && import.meta.env.DEV);

// --- AUTHENTICATED FETCH INTERCEPTOR ---
const originalFetch = window.fetch;
window.fetch = async (...args) => {
  let [resource, config] = args;
  
  if (typeof resource === 'string' && resource.startsWith(API_BASE)) {
    const { value: accessToken } = await Preferences.get({ key: 'sacc_access_token' });
    if (accessToken) {
      config = config || {};
      config.headers = {
        ...config.headers,
        'Authorization': `Bearer ${accessToken}`
      };
    }
  }

  let response = await originalFetch(resource, config);

  if (response.status === 401 && typeof resource === 'string' && resource.startsWith(API_BASE) &&
      !resource.includes('/auth/login') && !resource.includes('/auth/register') && !resource.includes('/auth/refresh')) {
    config = config || {};
    const { value: refreshToken } = await Preferences.get({ key: 'sacc_refresh_token' });
    if (refreshToken) {
      const refreshRes = await originalFetch(`${API_BASE}/auth/refresh`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refreshToken })
      });

      if (refreshRes.ok) {
        const { accessToken: newAccess, refreshToken: newRefresh } = await refreshRes.json();
        await Preferences.set({ key: 'sacc_access_token', value: newAccess });
        await Preferences.set({ key: 'sacc_refresh_token', value: newRefresh });
        
        config.headers = {
          ...config.headers,
          'Authorization': `Bearer ${newAccess}`
        };
        response = await originalFetch(resource, config);
      } else {
        localStorage.removeItem('sacc_current_user');
        await Preferences.remove({ key: 'sacc_access_token' });
        await Preferences.remove({ key: 'sacc_refresh_token' });
        window.dispatchEvent(new Event('sacc:session-ended'));
        window.location.hash = '#login';
      }
    } else {
      localStorage.removeItem('sacc_current_user');
      window.dispatchEvent(new Event('sacc:session-ended'));
      window.location.hash = '#login';
    }
  }
  return response;
};
// ----------------------------------------

// Opens the printable report in a new tab. The tab cannot send the Authorization header,
// so the current access token is passed in the URL and checked by the server.
const openPrintableReport = async (jobId) => {
  const { value: accessToken } = await Preferences.get({ key: 'sacc_access_token' });
  window.open(`${API_BASE}/jobs/${jobId}/pdf-report?token=${encodeURIComponent(accessToken || '')}`, '_blank');
};

// Guaranteed Native Vector PDF Generator (Writes crisp PDF text & tables; 100% non-blank)
const handleDownloadPdfReport = async (jobId, jobNumber) => {
  try {
    // 1. Fetch job details from API
    const res = await fetch(`${API_BASE}/jobs/${jobId}`);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const job = await res.json();

    // 2. Dynamically load jsPDF library if not present
    if (!window.jspdf) {
      await new Promise((resolve, reject) => {
        const script = document.createElement('script');
        script.src = 'https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js';
        script.onload = resolve;
        script.onerror = reject;
        document.head.appendChild(script);
      });
    }

    const { jsPDF } = window.jspdf;
    const doc = new jsPDF();

    // All times come from the database: JobStatusEvent rows, workStartedAt and completedAt
    const fmt = (d, withDate = false) => d
      ? new Date(d).toLocaleString('en-AU', { timeZone: 'Australia/Adelaide', ...(withDate ? { dateStyle: 'medium' } : {}), timeStyle: 'short' })
      : 'Not recorded';
    const events = Array.isArray(job.statusEvents) ? job.statusEvents : [];
    const firstAt = (statuses) => (events.find(e => statuses.includes(e.toStatus)) || {}).createdAt || null;
    const arrivedAt = firstAt(['ARRIVED']);
    const submittedFormatted = fmt(job.submittedAt, true);
    const dispatchedFormatted = fmt(firstAt(['TECH_ASSIGNED', 'TECHNICIAN_ASSIGNED']));
    const acceptedFormatted = fmt(firstAt(['ACCEPTED']));
    const travellingFormatted = fmt(firstAt(['TRAVELLING']));
    const arrivedFormatted = fmt(arrivedAt);
    const inProgressFormatted = fmt(job.workStartedAt || firstAt(['IN_PROGRESS']));
    const completedFormatted = fmt(job.completedAt || firstAt(['COMPLETED']), true);
    const responseMins = arrivedAt ? Math.round((new Date(arrivedAt) - new Date(job.submittedAt)) / 60000) : null;
    const labourMins = job.workStartedAt && job.completedAt
      ? Math.max(1, Math.round((new Date(job.completedAt) - new Date(job.workStartedAt)) / 60000))
      : (job.timerMinutes || 0);
    const slaText = !arrivedAt ? 'Not yet attended'
      : (job.targetAttendanceAt && new Date(arrivedAt) > new Date(job.targetAttendanceAt) ? 'MISSED' : 'PASSED (On Schedule)');
    const isDone = ['COMPLETED', 'REPORT_ISSUED', 'CLOSED'].includes(job.status);

    // --- Header ---
    doc.setFillColor(2, 134, 205); // #0286cd
    doc.rect(0, 0, 210, 24, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(13);
    doc.setFont('helvetica', 'bold');
    doc.text('SA EMERGENCY CLEANING', 14, 13);
    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    doc.text('Emergency Response & Service Completion Audit Report', 14, 19);

    doc.setFillColor(224, 242, 254);
    doc.roundedRect(148, 5, 48, 14, 3, 3, 'F');
    doc.setTextColor(3, 105, 161);
    doc.setFontSize(9);
    doc.setFont('helvetica', 'bold');
    doc.text(`JOB: ${job.jobNumber || jobId}`, 152, 14);

    // --- Customer & Incident Cards ---
    doc.setFillColor(248, 250, 252);
    doc.roundedRect(14, 30, 88, 38, 3, 3, 'F');
    doc.setDrawColor(226, 232, 240);
    doc.rect(14, 30, 88, 38, 'S');

    doc.setTextColor(100, 116, 139);
    doc.setFontSize(8);
    doc.text('CUSTOMER & SITE LOCATION', 18, 36);
    doc.setTextColor(15, 23, 42);
    doc.setFontSize(10);
    doc.setFont('helvetica', 'bold');
    doc.text(String(job.customerName || 'Adelaide Commercial Customer'), 18, 43);
    doc.setFontSize(8);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(71, 85, 105);
    doc.text(String(job.address || '100 King William St, Adelaide SA'), 18, 49);
    doc.text(`Contact: ${job.onsiteContact || 'Facility Manager'} (${job.onsitePhone || '0400 000 000'})`, 18, 55);

    doc.setFillColor(248, 250, 252);
    doc.roundedRect(108, 30, 88, 38, 3, 3, 'F');
    doc.rect(108, 30, 88, 38, 'S');

    doc.setTextColor(100, 116, 139);
    doc.setFontSize(8);
    doc.setFont('helvetica', 'bold');
    doc.text('INCIDENT & ATTENDANCE SUMMARY', 112, 36);
    doc.setTextColor(15, 23, 42);
    doc.setFontSize(8);
    doc.setFont('helvetica', 'normal');
    doc.text(`Category: ${job.category || 'Plumbing / Flood'} Emergency`, 112, 43);
    doc.text(`Submitted At: ${submittedFormatted}`, 112, 49);
    doc.text(`Technician: ${job.technicianName || 'Unassigned'}`, 112, 55);
    doc.setTextColor(4, 120, 87);
    doc.setFont('helvetica', 'bold');
    doc.text(isDone ? 'Status: COMPLETED & SIGNED OFF' : `Status: ${job.status}`, 112, 61);

    // --- Job Timing Audit Log Table ---
    doc.setFillColor(2, 134, 205);
    doc.rect(14, 74, 182, 7, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(9);
    doc.setFont('helvetica', 'bold');
    doc.text('JOB TIMING & SLA RESPONSE AUDIT LOG', 18, 79);

    const stages = [
      ['1. Request Submitted', submittedFormatted, String(job.customerName || 'Customer')],
      ['2. Admin Dispatched', dispatchedFormatted, 'SACC Operations Desk'],
      ['3. Technician Accepted', acceptedFormatted, String(job.technicianName || '-')],
      ['4. En Route (Transit Start)', travellingFormatted, 'GPS Location Transmitting'],
      ['5. Arrived On-Site', arrivedFormatted, String(job.locationName || 'Service Site')],
      ['6. Cleaning Commenced', inProgressFormatted, 'Labour timer started'],
      ['7. Job Completed', completedFormatted, isDone ? 'Completed' : '-']
    ];

    let y = 87;
    doc.setFillColor(241, 245, 249);
    doc.rect(14, 81, 182, 6, 'F');
    doc.setTextColor(100, 116, 139);
    doc.setFontSize(8);
    doc.text('LIFECYCLE STAGE', 18, 85);
    doc.text('TIMESTAMP', 90, 85);
    doc.text('STATUS / ACTOR', 145, 85);

    stages.forEach((stage, idx) => {
      if (idx % 2 === 1) {
        doc.setFillColor(248, 250, 252);
        doc.rect(14, y - 4, 182, 6, 'F');
      }
      doc.setTextColor(30, 41, 59);
      doc.setFont('helvetica', idx === 6 ? 'bold' : 'normal');
      if (idx === 6) doc.setTextColor(4, 120, 87);
      doc.text(stage[0], 18, y);
      doc.text(stage[1], 90, y);
      doc.text(stage[2], 145, y);
      y += 6;
    });

    // --- KPI Response Metric Cards ---
    y += 4;
    doc.setFillColor(239, 246, 255);
    doc.roundedRect(14, y, 58, 14, 2, 2, 'F');
    doc.setTextColor(29, 78, 216);
    doc.setFontSize(7);
    doc.setFont('helvetica', 'bold');
    doc.text('TOTAL RESPONSE TIME', 18, y + 5);
    doc.setFontSize(10);
    doc.text(responseMins === null ? 'Not recorded' : `${responseMins} Mins`, 18, y + 11);

    doc.setFillColor(240, 253, 244);
    doc.roundedRect(76, y, 58, 14, 2, 2, 'F');
    doc.setTextColor(21, 128, 61);
    doc.setFontSize(7);
    doc.setFont('helvetica', 'bold');
    doc.text('ON-SITE LABOUR DURATION', 80, y + 5);
    doc.setFontSize(10);
    doc.text(`${labourMins} Mins`, 80, y + 11);

    doc.setFillColor(250, 245, 255);
    doc.roundedRect(138, y, 58, 14, 2, 2, 'F');
    doc.setTextColor(126, 34, 206);
    doc.setFontSize(7);
    doc.setFont('helvetica', 'bold');
    doc.text('2-4 HR SLA TARGET', 142, y + 5);
    doc.setFontSize(10);
    doc.text(slaText, 142, y + 11);

    // --- Work Performed & Scope Log ---
    y += 20;
    doc.setFillColor(248, 250, 252);
    doc.roundedRect(14, y, 182, 22, 3, 3, 'F');
    doc.setDrawColor(226, 232, 240);
    doc.rect(14, y, 182, 22, 'S');

    doc.setTextColor(100, 116, 139);
    doc.setFontSize(8);
    doc.setFont('helvetica', 'bold');
    doc.text('WORK PERFORMED & SCOPE LOG', 18, y + 6);
    doc.setTextColor(30, 41, 59);
    doc.setFont('helvetica', 'normal');
    doc.text(`"${job.description || 'Emergency cleaning and hazard mitigation completed in full.'}"`, 18, y + 12);
    doc.text(`Labour: ${labourMins} Mins  |  Additional Overage Charges: $${job.additionalCharges || '0.00'}`, 18, y + 17);

    // --- Footer ---
    doc.setDrawColor(226, 232, 240);
    doc.line(14, 280, 196, 280);
    doc.setTextColor(148, 163, 184);
    doc.setFontSize(8);
    doc.text('© 2026 SA Emergency Cleaning Pty Ltd • 24/7 Response Desk • Adelaide, South Australia', 105, 285, { align: 'center' });

    // Download crisp vector PDF file directly
    doc.save(`SACC-Service-Completion-Report-${job.jobNumber || jobId}.pdf`);
  } catch (err) {
    console.error('jsPDF generation error:', err);
    openPrintableReport(jobId);
  }
};

// Default Dynamic Configuration State (Editable live in Admin Studio)
const initialDynamicConfig = {
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

// Initial Mock Customers
const initialCustomerAccounts = [
  {
    id: 'cust-1',
    businessName: "Mahima Commercial Enterprises Pty Ltd",
    abn: "48 123 456 789",
    primaryContactName: "Mahima Sharma",
    phoneNumber: "0412 345 678",
    email: "mahima@mahimaenterprises.com.au",
    membershipPlan: "business",
    paymentMethod: "PayTo Bank Direct",
    consecutiveMonths: 8,
    pointsBalance: 1592,
    calloutsUsed: 0,
    locations: [
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
  },
  {
    id: 'cust-2',
    businessName: "Adelaide Corporate Tower Management",
    abn: "99 876 543 210",
    primaryContactName: "David Ross",
    phoneNumber: "0418 987 654",
    email: "dross@adelaidetower.com.au",
    membershipPlan: "premium",
    paymentMethod: "PayTo Bank Direct",
    consecutiveMonths: 12,
    pointsBalance: 3192,
    calloutsUsed: 1,
    locations: [
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
];

const initialTechniciansList = [
  { id: 'tech-1', name: 'Dave Miller', phone: '0488 111 222', status: 'ON_SITE', activeJobId: 'SACC-2026-0812', rating: 4.9, avatar: 'https://images.unsplash.com/photo-1560250097-0b93528c311a?auto=format&fit=crop&w=150&q=80' },
  { id: 'tech-2', name: 'Chris Watson', phone: '0477 333 444', status: 'AVAILABLE', activeJobId: null, rating: 5.0, avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=150&q=80' }
];

// Which workspaces each role may open. Admin can open every workspace.
const ROLE_TABS = {
  customer: ['customer'],
  technician: ['technician'],
  config: ['config'],
  admin: ['customer', 'technician', 'admin', 'config']
};
const ROLE_HOME = { customer: '#customer', technician: '#technician', config: '#config', admin: '#admin/dispatch' };
const tabForHash = (hash) => {
  if (hash.startsWith('#customer')) return 'customer';
  if (hash.startsWith('#technician')) return 'technician';
  if (hash.startsWith('#config')) return 'config';
  if (hash.startsWith('#admin')) return 'admin';
  return null;
};
const canOpenHash = (role, hash) => {
  const tab = tabForHash(hash);
  return !tab || (ROLE_TABS[role] || []).includes(tab);
};

/* =========================================================================
   FAST SCREEN JUMPER LEFT-SIDE DRAWER (EXPANDS VIA 3-STRIPE BUTTON)
   ========================================================================= */
function NavigationSidebarDrawer({ isOpen, onClose, currentHash, navigateTo, currentUser }) {
  if (!isOpen) return null;

  const allRoutes = [
    { hash: '#customer', label: '📊 Customer Dashboard' },
    { hash: '#customer/request', label: '🚨 Request Emergency Cleaning' },
    { hash: '#customer/points', label: '🏆 Reward Points' },
    { hash: '#customer/profile', label: '👤 Profile & Password' },
    { hash: '#customer/cancel', label: '🛑 Cancel Membership' },
    { hash: '#technician', label: '🔧 Technician Dispatch App' },
    { hash: '#admin/dispatch', label: '🛡️ Admin Dispatch Desk' },
    { hash: '#admin/customers', label: '🏢 Customer Directory' },
    { hash: '#admin/register-company', label: '✍️ Admin Register Co.' },
    { hash: '#admin/technicians', label: '👨‍🔧 Technician Roster' },
    { hash: '#admin/points', label: '🎁 Points Approval' },
    { hash: '#admin/reports', label: '📈 Reports & Analytics' },
    { hash: '#admin/hotline', label: '📞 Hotline Phone Request' },
    { hash: '#config', label: '⚙️ Config Studio' }
  ];
  // Only list the screens this user's role is allowed to open
  const routes = allRoutes.filter(r => canOpenHash(currentUser?.role, r.hash));

  return (
    <div className="fixed inset-0 z-[100] flex animate-in fade-in duration-200">
      {/* Click outside backdrop to close */}
      <div 
        className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm transition-opacity cursor-pointer"
        onClick={onClose}
        aria-label="Close navigation sidebar"
      />

      {/* Top to Bottom Left Side Drawer */}
      <div className="relative w-80 max-w-[85vw] bg-slate-900 text-white h-full shadow-2xl flex flex-col z-10 border-r border-slate-800 animate-in slide-in-from-left duration-200">
        {/* Drawer Header */}
        <div className="p-4 border-b border-slate-800 flex items-center justify-between bg-slate-950/80">
          <div className="flex items-center gap-2.5">
            <div className="bg-[#0286cd] p-2 rounded-xl text-white shadow-md shadow-[#0286cd]/30">
              <Zap className="w-4 h-4 text-amber-300" />
            </div>
            <div>
              <h2 className="text-xs font-black uppercase tracking-wider text-white">
                Screen Jumper
              </h2>
              <p className="text-[10px] text-slate-400 font-medium">Quick switch screens & modules</p>
            </div>
          </div>
          <button 
            onClick={onClose}
            className="p-1.5 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
            title="Close menu"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* User Info banner if logged in */}
        {currentUser && (
          <div className="p-3 mx-3 mt-3 rounded-2xl bg-slate-800/80 border border-slate-700/60 flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-full bg-[#0286cd] text-white flex items-center justify-center font-black text-xs uppercase shrink-0 shadow-sm">
              {currentUser.name ? currentUser.name.charAt(0) : 'U'}
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-xs font-bold text-white truncate">{currentUser.name}</p>
              <div className="flex items-center gap-1.5 mt-0.5">
                <span className="text-[9px] uppercase font-black px-1.5 py-0.5 rounded bg-[#0286cd]/20 text-[#0286cd] border border-[#0286cd]/40">
                  {currentUser.role}
                </span>
                {currentUser.businessName && (
                  <span className="text-[10px] text-slate-400 truncate max-w-[130px]">
                    {currentUser.businessName}
                  </span>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Scrollable Route List */}
        <div className="flex-1 overflow-y-auto p-3 space-y-1.5 custom-scroll-container">
          <div className="text-[10px] font-extrabold uppercase tracking-wider text-slate-500 px-2 py-1">
            Available Screens
          </div>
          {routes.map(r => {
            const isActive = currentHash === r.hash || (r.hash === '#customer' && (!currentHash || currentHash === '' || currentHash === '#'));
            return (
              <button
                key={r.hash}
                onClick={() => {
                  navigateTo(r.hash);
                  onClose();
                }}
                className={`w-full text-left px-3.5 py-2.5 rounded-xl font-semibold text-xs flex items-center justify-between transition-all cursor-pointer ${
                  isActive
                    ? 'bg-[#0286cd] text-white shadow-md shadow-[#0286cd]/30 font-bold'
                    : 'text-slate-300 hover:bg-slate-800 hover:text-white'
                }`}
              >
                <span className="truncate">{r.label}</span>
                {isActive && <ChevronRight className="w-4 h-4 text-white shrink-0" />}
              </button>
            );
          })}
        </div>

        {/* Drawer Footer */}
        <div className="p-3 border-t border-slate-800 bg-slate-950/80 text-[11px] text-slate-400 flex items-center justify-between">
          <span className="font-semibold text-slate-300">SA Emergency Cleaning</span>
          <span className="text-[10px] font-mono text-slate-500">24/7 Response</span>
        </div>
      </div>
    </div>
  );
}

export default function App() {
  const [currentUser, setCurrentUser] = useState(() => {
    try {
      const saved = localStorage.getItem('sacc_current_user');
      if (saved) return JSON.parse(saved);
    } catch (e) {}
    return null;
  });
  const [activeTab, setActiveTab] = useState(() => {
    try {
      const saved = localStorage.getItem('sacc_active_tab');
      if (saved) return saved;
    } catch (e) {}
    return 'customer';
  });
  const [adminSubTab, setAdminSubTab] = useState('dispatch');
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [currentHash, setCurrentHash] = useState(() => {
    if (typeof window !== 'undefined') {
      const hash = window.location.hash;
      const saved = localStorage.getItem('sacc_current_user');
      if (!saved) return (hash === '#register' ? '#register' : '#login');
      return hash || '#customer';
    }
    return '#login';
  });

  const navigateTo = (hash) => {
    window.location.hash = hash;
  };

  const [config, setConfig] = useState(initialDynamicConfig);
  const [customerAccounts, setCustomerAccounts] = useState(initialCustomerAccounts);
  const [selectedCustomerId, setSelectedCustomerId] = useState('cust-1');
  const [technicians, setTechnicians] = useState(initialTechniciansList);
  const [jobs, setJobs] = useState([]);
  const [dbStatus, setDbStatus] = useState('CONNECTING...');
  
  // Modals & UI States
  const [showNewRequestModal, setShowNewRequestModal] = useState(false);
  const [showHotlineModal, setShowHotlineModal] = useState(false);
  const [showRedemptionModal, setShowRedemptionModal] = useState(false);
  const [showCalloutExplanationModal, setShowCalloutExplanationModal] = useState(false);

  // Registration & Account Management Modals
  const [showCompanyRegistrationModal, setShowCompanyRegistrationModal] = useState(false);
  const [registrationModalMode, setRegistrationModalMode] = useState('public'); // 'public' or 'admin'
  const [showProfileModal, setShowProfileModal] = useState(false);
  const [showCancelSubscriptionModal, setShowCancelSubscriptionModal] = useState(false);
  const [showChangePlanModal, setShowChangePlanModal] = useState(false);
  const [editingJob, setEditingJob] = useState(null);
  const [showTechSettingsMenu, setShowTechSettingsMenu] = useState(false);
  const [showTechProfileModal, setShowTechProfileModal] = useState(false);

  // The fetch interceptor fires this when the refresh token is rejected
  useEffect(() => {
    const onSessionEnded = () => setCurrentUser(null);
    window.addEventListener('sacc:session-ended', onSessionEnded);
    return () => window.removeEventListener('sacc:session-ended', onSessionEnded);
  }, []);

  // Save session state to localStorage on updates
  useEffect(() => {
    if (currentUser) {
      localStorage.setItem('sacc_current_user', JSON.stringify(currentUser));
    } else {
      localStorage.removeItem('sacc_current_user');
      localStorage.removeItem('sacc_active_tab');
    }
  }, [currentUser]);

  useEffect(() => {
    if (activeTab && currentUser) {
      localStorage.setItem('sacc_active_tab', activeTab);
    }
  }, [activeTab, currentUser]);

  // Hash-based Browser Routing Engine.
  // The listener reads the user from a ref, so a hash change fired right after login sees the new user.
  const currentUserRef = useRef(currentUser);
  currentUserRef.current = currentUser;

  useEffect(() => {
    const handleHashChange = () => {
      const user = currentUserRef.current;
      const hash = window.location.hash || (user ? (ROLE_HOME[user.role] || '#customer') : '#login');
      setCurrentHash(hash);

      if (!user) {
        if (hash !== '#login' && hash !== '#register') {
          window.location.hash = '#login';
        }
        return;
      }

      // Already signed in: the login page sends you to your own workspace
      if (hash === '#login') {
        setShowCompanyRegistrationModal(false);
        window.location.hash = ROLE_HOME[user.role] || '#customer';
        return;
      }

      if (hash === '#register') {
        setRegistrationModalMode('public');
        setShowCompanyRegistrationModal(true);
        return;
      }

      // A role can only open its own workspaces, whatever the URL says
      if (!canOpenHash(user.role, hash)) {
        window.location.hash = ROLE_HOME[user.role] || '#login';
        return;
      }

      // Sync Modals
      setShowNewRequestModal(hash === '#customer/request');
      setShowRedemptionModal(hash === '#customer/points');
      setShowProfileModal(hash === '#customer/profile');
      setShowCancelSubscriptionModal(hash === '#customer/cancel');
      setShowCalloutExplanationModal(hash === '#customer/callouts');
      setShowHotlineModal(hash === '#admin/hotline');

      if (hash.startsWith('#customer')) {
        setActiveTab('customer');
      } else if (hash.startsWith('#technician')) {
        setActiveTab('technician');
      } else if (hash.startsWith('#config')) {
        setActiveTab('config');
      } else if (hash.startsWith('#admin')) {
        setActiveTab('admin');
        if (hash === '#admin/customers') setAdminSubTab('customers');
        else if (hash === '#admin/technicians') setAdminSubTab('technicians');
        else if (hash === '#admin/points') setAdminSubTab('points');
        else if (hash === '#admin/reports') setAdminSubTab('reports');
        else if (hash === '#admin/register-company') {
          setAdminSubTab('customers');
          setRegistrationModalMode('admin');
          setShowCompanyRegistrationModal(true);
        } else {
          setAdminSubTab('dispatch');
        }
      }
    };

    handleHashChange();
    window.addEventListener('hashchange', handleHashChange);
    return () => window.removeEventListener('hashchange', handleHashChange);
  }, [currentUser]);

  // Fetch Real Data from Backend API Server (runs again whenever a different user signs in)
  const loadData = async () => {
    try {
      const healthRes = await fetch(`${API_BASE}/health`);
      const healthData = await healthRes.json();
      if (healthData.status === 'ONLINE') {
        setDbStatus('ONLINE (Azure/SQLite DB)');
      }

      const configRes = await fetch(`${API_BASE}/config`);
      const configData = await configRes.json();
      if (configData.membershipPlans) setConfig(configData);

      // Everything below needs a signed-in user
      if (!currentUser) return;

      const custRes = await fetch(`${API_BASE}/customers`);
      const custData = await custRes.json();
      if (custRes.ok && Array.isArray(custData) && custData.length > 0) setCustomerAccounts(custData);

      const jobsRes = await fetch(`${API_BASE}/jobs`);
      const jobsData = await jobsRes.json();
      if (jobsRes.ok && Array.isArray(jobsData)) setJobs(jobsData);

      if (['admin', 'technician', 'config'].includes(currentUser.role)) {
        const techRes = await fetch(`${API_BASE}/technicians`);
        const techData = await techRes.json();
        if (techRes.ok && Array.isArray(techData)) setTechnicians(techData);
      }
    } catch (err) {
      console.warn('Backend API server offline.', err);
      setDbStatus('OFFLINE');
    }
  };

  useEffect(() => {
    loadData();
  }, [currentUser?.id]);

  const activeCustomer = customerAccounts.find(c => c.id === selectedCustomerId) || customerAccounts[0];
  const activeJob = jobs[0];
  const activePlan = config.membershipPlans.find(p => p.id === activeCustomer.membershipPlan) || config.membershipPlans[1];

  // Handle Login Event
  const handleLogin = async (user, accessToken, refreshToken) => {
    if (accessToken) await Preferences.set({ key: 'sacc_access_token', value: accessToken });
    if (refreshToken) await Preferences.set({ key: 'sacc_refresh_token', value: refreshToken });
    
    setCurrentUser(user);
    if (user.businessId) setSelectedCustomerId(user.businessId);
    else if (user.organizationId) setSelectedCustomerId(user.organizationId);
    
    // Routing relies strictly on the authenticated credential role returned by the server
    const role = (user.role || '').toLowerCase();
    if (role === 'customer') {
      setActiveTab('customer');
      navigateTo('#customer');
    } else if (role === 'technician') {
      setActiveTab('technician');
      navigateTo('#technician');
    } else if (role === 'config') {
      setActiveTab('config');
      navigateTo('#config');
    } else {
      setActiveTab('admin');
      navigateTo('#admin/dispatch');
    }
  };

  // Handle Logout Event
  const handleLogout = async () => {
    try {
      await fetch(`${API_BASE}/auth/logout`, { method: 'POST' });
    } catch (e) {
      console.warn('Logout could not reach the server:', e);
    }
    try {
      localStorage.removeItem('sacc_current_user');
      localStorage.removeItem('sacc_active_tab');
      await Preferences.remove({ key: 'sacc_access_token' });
      await Preferences.remove({ key: 'sacc_refresh_token' });
    } catch (e) {}
    setCurrentUser(null);
    navigateTo('#login');
  };

  // Handle Registration Success
  const handleRegisterSuccess = async (newCustomer, payload) => {
    setCustomerAccounts([newCustomer, ...customerAccounts]);
    setSelectedCustomerId(newCustomer.id);
    setShowCompanyRegistrationModal(false);

    if (registrationModalMode === 'public') {
      // Sign the new company in through the normal login so it gets real tokens
      try {
        const res = await fetch(`${API_BASE}/auth/login`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email: payload.email, password: payload.password })
        });
        const data = await res.json();
        if (res.ok && data.user) {
          await handleLogin(data.user, data.accessToken, data.refreshToken);
        } else {
          navigateTo('#login');
        }
      } catch (e) {
        navigateTo('#login');
      }
    }
  };

  // Handle Profile Update Success
  const handleProfileUpdateSuccess = (updatedCustomer) => {
    setCustomerAccounts(customerAccounts.map(c => c.id === updatedCustomer.id ? updatedCustomer : c));
    setShowProfileModal(false);
  };

  // Handle Subscription Cancellation Success
  const handleSubscriptionCancelSuccess = (updatedCustomer) => {
    setCustomerAccounts(customerAccounts.map(c => c.id === updatedCustomer.id ? updatedCustomer : c));
    setShowCancelSubscriptionModal(false);
  };

  // Open Registration Modal Helper
  const openPublicRegistrationModal = () => {
    setRegistrationModalMode('public');
    setShowCompanyRegistrationModal(true);
  };

  const openAdminRegistrationModal = () => {
    setRegistrationModalMode('admin');
    setShowCompanyRegistrationModal(true);
  };

  // Timer Tick Engine for Technician View
  useEffect(() => {
    const interval = setInterval(() => {
      setJobs(prevJobs => prevJobs.map(job => {
        if (job.status === 'IN_PROGRESS' && job.workStartedAt) {
          return { ...job, timerMinutes: Math.max(0, Math.floor((Date.now() - new Date(job.workStartedAt).getTime()) / 60000)) };
        }
        return job;
      }));
    }, 30000);
    return () => clearInterval(interval);
  }, []);

  // 1. UNAUTHENTICATED STATE: Render Login Portal Screen (No sidebar/hamburger button on login or register)
  if (!currentUser) {
    return (
      <>
        <LoginPortal 
          onLogin={handleLogin} 
          dbStatus={dbStatus} 
          customerAccounts={customerAccounts} 
          onOpenRegister={openPublicRegistrationModal}
        />
        {showCompanyRegistrationModal && (
          <CompanyRegistrationModal 
            onClose={() => setShowCompanyRegistrationModal(false)}
            onRegisterSuccess={handleRegisterSuccess}
            isAdminMode={false}
            config={config}
          />
        )}
      </>
    );
  }

  // Each role may only open its own workspaces, whatever the URL or saved tab says
  const allowedTabs = ROLE_TABS[currentUser.role] || [];
  const visibleTab = allowedTabs.includes(activeTab) ? activeTab : allowedTabs[0];

  // 2. AUTHENTICATED STATE: Render Main Application with Navigation Header
  return (
    <div className="min-h-screen text-slate-800 flex flex-col login-card-gradient">
      {/* Left-Side Drawer: Expands when clicking 3-stripe button */}
      <NavigationSidebarDrawer 
        isOpen={isSidebarOpen} 
        onClose={() => setIsSidebarOpen(false)} 
        currentHash={currentHash} 
        navigateTo={navigateTo}
        currentUser={currentUser}
      />

      {/* Top Header with 3-Stripe Hamburger Menu & Universal Top-Right Log Out Button */}
      <header className="sticky top-0 z-50 bg-white/95 backdrop-blur-md border-b border-slate-200 shadow-sm px-4 lg:px-8 py-3 flex flex-wrap items-center justify-between gap-4">
        {/* Left Side: 3-Stripe Hamburger Menu Button + Logo + Title */}
        <div className="flex items-center gap-3">
          <button
            onClick={() => setIsSidebarOpen(!isSidebarOpen)}
            aria-label="Toggle navigation drawer"
            className="p-2.5 rounded-xl text-slate-700 hover:text-[#0286cd] hover:bg-blue-50 border border-slate-300 transition-all cursor-pointer shadow-sm flex items-center justify-center"
            title={isSidebarOpen ? "Close Navigation Menu" : "Open Navigation Menu"}
          >
            <Menu className="w-5 h-5 text-slate-800" />
          </button>

          <div className="bg-[#e4e4e4] p-2 rounded-xl shadow-sm border border-slate-300 flex items-center justify-center">
            <img src="/logo.webp" alt="SA Commercial Cleaning Services" className="h-9 w-auto object-contain" />
          </div>
          <div>
            <h1 className="text-lg font-black tracking-tight text-slate-900 flex items-center gap-2">
              SA Emergency Cleaning
            </h1>
            <p className="text-[11px] text-[#0286cd] font-semibold">SA Emergency Cleaning Pty Ltd • 24/7 Response Desk</p>
          </div>
        </div>

        {/* Top Right Corner: Account Selector + User Badge + Universal Log Out Button for All User Types */}
        <div className="flex items-center gap-3">
          {/* Customer Account Selector Dropdown (Shown for Admin role) */}
          {(currentUser.role === 'admin') && (
            <div className="flex items-center gap-2 bg-slate-50 border border-slate-300 px-3.5 py-1.5 rounded-xl shadow-sm">
              <Building className="w-4 h-4 text-[#0286cd]" />
              <div className="text-left">
                <div className="text-[9px] text-slate-500 uppercase font-extrabold">Active Business Account:</div>
                <select
                  value={selectedCustomerId}
                  onChange={(e) => setSelectedCustomerId(e.target.value)}
                  className="bg-transparent text-xs font-extrabold text-[#0286cd] focus:outline-none cursor-pointer"
                >
                  {customerAccounts.map(c => (
                    <option key={c.id} value={c.id} className="bg-white text-slate-900 font-medium">
                      {c.businessName} ({c.membershipPlan.toUpperCase()})
                    </option>
                  ))}
                </select>
              </div>
            </div>
          )}

          {/* User Badge / Info Pill */}
          <div className="hidden sm:flex items-center gap-2.5 bg-slate-50 border border-slate-200 px-3 py-1.5 rounded-xl shadow-sm">
            <div className="w-7 h-7 rounded-full bg-[#0286cd] text-white flex items-center justify-center font-black text-xs shrink-0 shadow-sm">
              {currentUser.name ? currentUser.name.charAt(0) : 'U'}
            </div>
            <div className="text-left leading-tight">
              <div className="text-xs font-black text-slate-900 truncate max-w-[130px]">{currentUser.name}</div>
              <div className="text-[10px] font-extrabold text-[#0286cd] uppercase">{currentUser.role}</div>
            </div>
          </div>

          {/* Technician Settings Gear Icon Dropdown (Shown for Technician role) */}
          {(currentUser.role === 'technician') && (
            <div className="relative">
              <button
                onClick={() => setShowTechSettingsMenu(!showTechSettingsMenu)}
                className="p-2.5 rounded-2xl bg-slate-100 hover:bg-slate-200 border border-slate-300 text-slate-700 transition-all cursor-pointer shadow-sm flex items-center gap-2 font-bold text-xs"
              >
                <Settings className="w-4 h-4 text-[#0286cd]" />
                <span className="hidden sm:inline">Settings</span>
                <ChevronDown className="w-3.5 h-3.5 text-slate-500" />
              </button>

              {showTechSettingsMenu && (
                <div className="absolute right-0 mt-2 w-48 bg-white rounded-2xl shadow-2xl border border-slate-200 py-2 z-50 text-xs">
                  <button
                    onClick={() => { setShowTechSettingsMenu(false); setShowTechProfileModal(true); }}
                    className="w-full text-left px-4 py-2.5 hover:bg-slate-50 flex items-center gap-2 font-semibold text-slate-800"
                  >
                    <User className="w-4 h-4 text-[#0286cd]" />
                    <span>Profile</span>
                  </button>
                </div>
              )}
            </div>
          )}

          {/* UNIVERSAL LOG OUT BUTTON FOR EACH USER TYPE */}
          <button
            onClick={handleLogout}
            className="flex items-center gap-1.5 bg-red-50 hover:bg-red-100 text-red-600 hover:text-red-700 border border-red-200 hover:border-red-300 font-extrabold px-3.5 py-2 rounded-xl text-xs transition-all shadow-sm cursor-pointer"
            title="Log Out of System"
          >
            <LogOut className="w-4 h-4 text-red-500 shrink-0" />
            <span className="hidden sm:inline">Log Out</span>
          </button>
        </div>
      </header>

      {/* NATIVE ANDROID MOBILE TOUCH BOTTOM NAVIGATION BAR (Admin Only) */}
      {currentUser.role === 'admin' && (
        <div className="fixed bottom-0 left-0 right-0 z-40 bg-white/95 backdrop-blur-md border-t border-slate-200 p-2 flex justify-around shadow-2xl text-slate-700">
          {(currentUser.role === 'admin') && (
            <button
              onClick={() => setActiveTab('customer')}
              className={`flex flex-col items-center py-1 px-4 rounded-xl transition-all cursor-pointer ${
                activeTab === 'customer' ? 'text-[#0286cd] font-extrabold bg-[#0286cd]/10 shadow-sm' : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              <Building className="w-5 h-5" />
              <span className="text-[10px] mt-0.5">Customer</span>
            </button>
          )}

          {(currentUser.role === 'technician' || currentUser.role === 'admin') && (
            <button
              onClick={() => setActiveTab('technician')}
              className={`flex flex-col items-center py-1 px-4 rounded-xl transition-all cursor-pointer ${
                activeTab === 'technician' ? 'text-[#0286cd] font-extrabold bg-[#0286cd]/10 shadow-sm' : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              <Wrench className="w-5 h-5" />
              <span className="text-[10px] mt-0.5">Technician</span>
            </button>
          )}

          {(currentUser.role === 'admin') && (
            <button
              onClick={() => setActiveTab('admin')}
              className={`flex flex-col items-center py-1 px-4 rounded-xl transition-all cursor-pointer ${
                activeTab === 'admin' ? 'text-[#0286cd] font-extrabold bg-[#0286cd]/10 shadow-sm' : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              <ShieldAlert className="w-5 h-5" />
              <span className="text-[10px] mt-0.5">Admin Ops</span>
            </button>
          )}

          {(currentUser.role === 'config' || currentUser.role === 'admin') && (
            <button
              onClick={() => setActiveTab('config')}
              className={`flex flex-col items-center py-1 px-4 rounded-xl transition-all cursor-pointer ${
                activeTab === 'config' ? 'text-emerald-600 font-extrabold bg-emerald-50 shadow-sm' : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              <Settings className="w-5 h-5" />
              <span className="text-[10px] mt-0.5">Config</span>
            </button>
          )}

          <button
            onClick={handleLogout}
            className="flex flex-col items-center py-1 px-4 rounded-xl transition-all cursor-pointer text-red-500 hover:bg-red-50 font-medium"
          >
            <X className="w-5 h-5" />
            <span className="text-[10px] mt-0.5">Log Out</span>
          </button>
        </div>
      )}

      {/* Main App Body */}
      <main className="flex-1 p-4 lg:p-8 max-w-7xl w-full mx-auto space-y-8 pb-32">
        {/* CUSTOMER PORTAL VIEW */}
        {visibleTab === 'customer' && (
          <CustomerPortal 
            account={activeCustomer} 
            activePlan={activePlan} 
            config={config} 
            jobs={jobs}
            setJobs={setJobs}
            setShowNewRequestModal={setShowNewRequestModal}
            setShowRedemptionModal={setShowRedemptionModal}
            setShowCalloutExplanationModal={setShowCalloutExplanationModal}
            setShowProfileModal={setShowProfileModal}
            setShowCancelSubscriptionModal={setShowCancelSubscriptionModal}
            setShowChangePlanModal={setShowChangePlanModal}
            setEditingJob={setEditingJob}
            handleLogout={handleLogout}
          />
        )}

        {/* TECHNICIAN MOBILE APP VIEW */}
        {visibleTab === 'technician' && (
          <TechnicianApp 
            jobs={jobs}
            setJobs={setJobs}
            currentUser={currentUser}
            setCurrentUser={setCurrentUser}
            handleLogout={handleLogout}
            showProfileModal={showTechProfileModal}
            setShowProfileModal={setShowTechProfileModal}
          />
        )}

        {/* ADMIN OPERATIONS & ACCOUNTS HUB VIEW */}
        {visibleTab === 'admin' && (
          <AdminOperationsHub 
            jobs={jobs}
            setJobs={setJobs}
            config={config}
            customers={customerAccounts}
            setCustomers={setCustomerAccounts}
            setSelectedCustomerId={setSelectedCustomerId}
            setActiveTab={setActiveTab}
            technicians={technicians}
            setTechnicians={setTechnicians}
            setShowHotlineModal={setShowHotlineModal}
            openCompanyRegistrationModal={openAdminRegistrationModal}
            adminSubTab={adminSubTab}
            setAdminSubTab={setAdminSubTab}
          />
        )}

        {/* DYNAMIC ADMIN CONFIG STUDIO */}
        {visibleTab === 'config' && (
          <DynamicConfigStudio 
            config={config}
            setConfig={setConfig}
          />
        )}
      </main>

      {/* MODALS */}
      {showCompanyRegistrationModal && (
        <CompanyRegistrationModal 
          onClose={() => setShowCompanyRegistrationModal(false)}
          onRegisterSuccess={handleRegisterSuccess}
          isAdminMode={registrationModalMode === 'admin'}
          config={config}
        />
      )}

      {showProfileModal && (
        <CompanyProfileModal 
          account={activeCustomer}
          onClose={() => setShowProfileModal(false)}
          onUpdateSuccess={handleProfileUpdateSuccess}
          onSitesChanged={(updated) => setCustomerAccounts(prev => prev.map(c => c.id === updated.id ? updated : c))}
          handleLogout={handleLogout}
        />
      )}

      {showCancelSubscriptionModal && (
        <CancelSubscriptionModal 
          account={activeCustomer}
          onClose={() => setShowCancelSubscriptionModal(false)}
          onCancelSuccess={handleSubscriptionCancelSuccess}
        />
      )}

      {showChangePlanModal && (
        <ChangePlanModal 
          account={activeCustomer}
          activePlan={activePlan}
          config={config}
          onClose={() => setShowChangePlanModal(false)}
          onPlanChangeSuccess={(updatedCustomer) => {
            setCustomerAccounts(customerAccounts.map(c => c.id === updatedCustomer.id ? updatedCustomer : c));
            setShowChangePlanModal(false);
          }}
        />
      )}

      {showNewRequestModal && (
        <NewEmergencyRequestModal 
          account={activeCustomer}
          config={config}
          onClose={() => setShowNewRequestModal(false)}
          onSubmit={async (newJobData) => {
            try {
              const res = await fetch(`${API_BASE}/jobs`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(newJobData)
              });
              const data = await res.json();
              if (!res.ok || data.error) {
                alert(data.error || 'The emergency request could not be submitted.');
                // Offer a plan upgrade only when the call-out allowance is used up
                if ((data.error || '').includes('Call-out Limit')) {
                  setShowNewRequestModal(false);
                  setShowChangePlanModal(true);
                }
                return;
              }
              setJobs([data, ...jobs]);
              setCustomerAccounts(customerAccounts.map(c => c.id === activeCustomer.id ? { ...c, calloutsUsed: (c.calloutsUsed || 0) + 1 } : c));
            } catch (err) {
              alert('Network error: Unable to submit emergency request to server.');
            }
            setShowNewRequestModal(false);
          }}
        />
      )}

      {editingJob && (
        <EditEmergencyRequestModal
          job={editingJob}
          account={activeCustomer}
          config={config}
          onClose={() => setEditingJob(null)}
          onSave={async (updatedFields) => {
            try {
              const res = await fetch(`${API_BASE}/jobs/${editingJob.id}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(updatedFields)
              });
              const data = await res.json();
              if (!res.ok || data.error) {
                alert(data.error || 'Failed to update request.');
                return;
              }
              setJobs(jobs.map(j => j.id === editingJob.id ? data : j));
              setEditingJob(null);
            } catch (err) {
              alert('Network error: Unable to save your changes to the server. Nothing was changed.');
            }
          }}
        />
      )}

      {showHotlineModal && (
        <HotlineBookingModal 
          account={activeCustomer}
          customerAccounts={customerAccounts}
          config={config}
          onClose={() => setShowHotlineModal(false)}
          onSubmit={async (newJobData) => {
            try {
              const res = await fetch(`${API_BASE}/jobs`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(newJobData)
              });
              const data = await res.json();
              if (res.ok && data.id) {
                setJobs([data, ...jobs]);
                setShowHotlineModal(false);
              } else {
                alert(data.error || 'Failed to submit hotline booking.');
              }
            } catch (err) {
              alert('Network error: Unable to submit hotline booking to server.');
            }
          }}
        />
      )}

      {showRedemptionModal && (
        <PointsRedemptionModal 
          account={activeCustomer}
          config={config}
          onClose={() => setShowRedemptionModal(false)}
        />
      )}

      {showCalloutExplanationModal && (
        <CalloutExplanationModal 
          account={activeCustomer}
          activePlan={activePlan}
          config={config}
          onClose={() => setShowCalloutExplanationModal(false)}
        />
      )}

      {/* Footer */}
      <footer className="border-t border-slate-900/80 py-6 px-4 text-center text-xs text-slate-500">
        <p>© 2026 SA Commercial Cleaning Services Pty Ltd (SACC). All rights reserved.</p>
        <p className="mt-1 text-cyan-400/60">Target Emergency Attendance Time: 2–4 hours from validated request timestamp. Azure Cloud Australia East (Sydney).</p>
      </footer>
    </div>
  );
}

/* =========================================================================
   CUSTOMER PORTAL COMPONENT
   ========================================================================= */
/* =========================================================================
   CUSTOMER PORTAL COMPONENT
   ========================================================================= */
function CustomerPortal({ 
  account, 
  activePlan, 
  config, 
  jobs, 
  setJobs, 
  setShowNewRequestModal, 
  setShowRedemptionModal, 
  setShowCalloutExplanationModal, 
  setShowProfileModal, 
  setShowCancelSubscriptionModal,
  setShowChangePlanModal,
  setEditingJob,
  handleLogout
}) {
  const [showSettingsMenu, setShowSettingsMenu] = useState(false);
  const calloutsRemaining = Math.max(0, (activePlan?.callouts || 2) - account.calloutsUsed);
  const isTenureUnlocked = account.consecutiveMonths >= config.tenureMinMonths;
  const isCancelled = account.subscriptionStatus === 'CANCELLED';

  // Filter all emergency jobs for this business customer account
  const [requestListTab, setRequestListTab] = useState('ongoing'); // 'ongoing' or 'past'
  const [selectedJobForLiveMap, setSelectedJobForLiveMap] = useState(null);

  const customerJobs = jobs.filter(j => j.organizationId === account.id || j.customerName === account.businessName);

  const ongoingJobs = customerJobs.filter(j => 
    !['COMPLETED', 'REPORT_ISSUED', 'CLOSED', 'CANCELLED'].includes(j.status)
  );

  const pastJobs = customerJobs.filter(j => 
    ['COMPLETED', 'REPORT_ISSUED', 'CLOSED', 'CANCELLED'].includes(j.status)
  );

  const displayedJobs = requestListTab === 'ongoing' ? ongoingJobs : pastJobs;
  const isCalloutsExhausted = calloutsRemaining <= 0 || account.calloutsUsed >= (activePlan?.callouts || 2);

  return (
    <div className="space-y-8">
      {/* Customer Header Info Bar with Settings Gear Dropdown */}
      <div className="bg-white p-5 rounded-2xl flex flex-wrap items-center justify-between gap-4 border border-slate-200 shadow-md relative">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-xl font-bold text-slate-900">{account.businessName}</h2>
            <span className={`text-[10px] font-bold px-2.5 py-0.5 rounded-full border ${
              isCancelled 
                ? 'bg-red-50 text-red-700 border-red-200' 
                : 'bg-emerald-50 text-emerald-700 border-emerald-200'
            }`}>
              {isCancelled ? '❌ Subscription Cancelled' : '✓ Active Membership'}
            </span>
          </div>
          <p className="text-xs text-slate-600 mt-1">
            ABN: {account.abn} • Contact: {account.primaryContactName || account.primaryContact} ({account.phoneNumber || account.phone}) • {account.email}
          </p>
        </div>

        <div className="flex items-center gap-3">
          <span className="text-xs font-mono text-emerald-700 bg-emerald-50 px-3 py-1.5 rounded-xl border border-emerald-200 font-semibold">
            💳 Payment: {account.paymentMethod}
          </span>

          {/* Settings Gear Dropdown Button */}
          <div className="relative">
            <button
              onClick={() => setShowSettingsMenu(!showSettingsMenu)}
              className="bg-slate-100 hover:bg-slate-200 text-slate-800 font-bold p-2.5 rounded-xl text-xs flex items-center gap-2 border border-slate-300 transition-all cursor-pointer shadow-sm"
              title="Account Settings"
            >
              <Settings className="w-4 h-4 text-[#0286cd]" />
              <span>Settings</span>
              <ChevronDown className="w-3.5 h-3.5 text-slate-500" />
            </button>

            {/* Dropdown Menu */}
            {showSettingsMenu && (
              <div 
                className="absolute right-0 mt-2 w-56 bg-white rounded-2xl border border-slate-200 shadow-2xl z-50 py-2 text-xs divide-y divide-slate-100"
                onClick={() => setShowSettingsMenu(false)}
              >
                <div className="py-1">
                  <button
                    onClick={() => setShowProfileModal(true)}
                    className="w-full text-left px-4 py-2.5 hover:bg-slate-50 flex items-center gap-2 font-semibold text-slate-800"
                  >
                    <User className="w-4 h-4 text-[#0286cd]" />
                    <span>Profile</span>
                  </button>
                  <button
                    onClick={() => setShowChangePlanModal(true)}
                    className="w-full text-left px-4 py-2.5 hover:bg-slate-50 flex items-center gap-2 font-semibold text-slate-800"
                  >
                    <Shield className="w-4 h-4 text-emerald-600" />
                    <span>Change Plan</span>
                  </button>
                </div>
                {!isCancelled && (
                  <div className="py-1">
                    <button
                      onClick={() => setShowCancelSubscriptionModal(true)}
                      className="w-full text-left px-4 py-2.5 hover:bg-red-50 flex items-center gap-2 font-semibold text-red-600"
                    >
                      <X className="w-4 h-4 text-red-500" />
                      <span>Cancel Subscription</span>
                    </button>
                  </div>
                )}
                <div className="py-1">
                  <button
                    onClick={handleLogout}
                    className="w-full text-left px-4 py-2.5 hover:bg-slate-50 flex items-center gap-2 font-semibold text-slate-600"
                  >
                    <X className="w-4 h-4 text-slate-400" />
                    <span>Log Out</span>
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* CENTERED PRIMARY EMERGENCY ASSISTANCE BANNER TILE (TOP OF SYSTEM) */}
      {isCalloutsExhausted ? (
        <div className="bg-gradient-to-br from-amber-700 via-amber-600 to-amber-800 p-8 rounded-3xl text-white text-center shadow-xl border border-amber-400/30 max-w-3xl mx-auto space-y-4">
          <div className="inline-flex items-center justify-center p-3.5 rounded-2xl bg-white/10 backdrop-blur-md border border-white/20 shadow-inner">
            <AlertTriangle className="w-8 h-8 text-amber-200 animate-pulse" />
          </div>
          <div className="space-y-1">
            <h2 className="text-2xl font-black text-white tracking-tight">Call-out Limit Exhausted (0 Remaining)</h2>
            <p className="text-sm font-semibold text-amber-100">
              You have used all {account.calloutsUsed} of {activePlan?.callouts} call-outs for your {activePlan?.name} plan this month.
            </p>
          </div>
          <div>
            <button
              onClick={() => setShowChangePlanModal(true)}
              className="bg-white hover:bg-slate-100 text-amber-900 font-black py-4 px-8 rounded-2xl text-xs sm:text-sm inline-flex items-center justify-center gap-3 transition-all shadow-xl hover:scale-105 cursor-pointer border border-white"
            >
              <Shield className="w-5 h-5 text-amber-700" />
              0 CALL-OUTS REMAINING - UPGRADE PLAN TO REQUEST
            </button>
          </div>
        </div>
      ) : (
        <div className="bg-gradient-to-br from-[#0f3cad] via-[#0286cd] to-[#026fa8] p-8 rounded-3xl text-white text-center shadow-xl border border-white/20 max-w-3xl mx-auto space-y-4">
          <div className="inline-flex items-center justify-center p-3.5 rounded-2xl bg-white/10 backdrop-blur-md border border-white/20 shadow-inner">
            <ShieldAlert className="w-8 h-8 text-amber-300 animate-pulse" />
          </div>
          <div className="space-y-1">
            <h2 className="text-2xl font-black text-white tracking-tight">Need Emergency Assistance?</h2>
            <p className="text-sm font-semibold text-blue-100">2–4 Hour Target Attendance On-Site • 24/7 Response Desk</p>
          </div>
          <div>
            <button
              onClick={() => setShowNewRequestModal(true)}
              className="bg-white hover:bg-slate-100 text-[#0f3cad] font-black py-4 px-8 rounded-2xl text-xs sm:text-sm inline-flex items-center justify-center gap-3 transition-all shadow-xl hover:scale-105 cursor-pointer border border-white"
            >
              <PlusCircle className="w-5 h-5 text-[#0f3cad]" />
              REQUEST EMERGENCY CLEANING
            </button>
          </div>
        </div>
      )}

      {/* DASHBOARD METRIC TILES GRID (BELOW MAIN REQUEST TILE) */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Membership Plan Card */}
        <div className="bg-white p-5 rounded-2xl border-l-4 border-l-[#0286cd] border border-slate-200 shadow-md space-y-2">
          <div className="flex items-center justify-between text-slate-500 text-xs font-semibold uppercase tracking-wider">
            <span>Active Membership</span>
            <Shield className="w-4 h-4 text-[#0286cd]" />
          </div>
          <div className="flex items-baseline justify-between">
            <span className="text-2xl font-extrabold text-slate-900">{activePlan?.name} Plan</span>
            <span className="text-sm font-bold text-[#0286cd]">${activePlan?.price}/mo</span>
          </div>
          <div className="flex items-center justify-between pt-1">
            <p className="text-xs text-slate-600">{activePlan?.callouts} Included Call-out(s) / mo</p>
            <button
              onClick={() => setShowChangePlanModal(true)}
              className="text-[11px] text-[#0286cd] font-bold underline hover:text-[#026fa8] cursor-pointer"
            >
              Change Plan
            </button>
          </div>
        </div>

        {/* Included Call-Outs Balance Card */}
        <div className="bg-white p-5 rounded-2xl border-l-4 border-l-emerald-500 border border-slate-200 shadow-md space-y-2 relative">
          <div className="flex items-center justify-between text-slate-500 text-xs font-semibold uppercase tracking-wider">
            <span>Call-outs Remaining</span>
            <button 
              onClick={() => setShowCalloutExplanationModal(true)}
              className="text-[10px] text-[#0286cd] bg-blue-50 hover:bg-blue-100 px-2 py-0.5 rounded border border-blue-200 flex items-center gap-1 font-bold cursor-pointer"
            >
              <AlertCircle className="w-3 h-3 text-[#0286cd]" /> Explain This
            </button>
          </div>
          <div className="flex items-baseline justify-between">
            <span className={`text-3xl font-extrabold ${isCalloutsExhausted ? 'text-amber-600' : 'text-emerald-600'}`}>
              {calloutsRemaining} / {activePlan?.callouts}
            </span>
            <span className="text-xs text-slate-500">Resets in 12 days</span>
          </div>
          <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden border border-slate-200">
            <div 
              className={`h-full rounded-full transition-all ${isCalloutsExhausted ? 'bg-amber-500' : 'bg-emerald-500'}`} 
              style={{ width: `${(calloutsRemaining / (activePlan?.callouts || 1)) * 100}%` }}
            ></div>
          </div>
        </div>

        {/* Reward Points Wallet */}
        <div className="bg-white p-5 rounded-2xl border-l-4 border-l-purple-500 border border-slate-200 shadow-md space-y-2">
          <div className="flex items-center justify-between text-slate-500 text-xs font-semibold uppercase tracking-wider">
            <span>Reward Points Wallet</span>
            <Award className="w-4 h-4 text-purple-600" />
          </div>
          <div className="flex items-baseline justify-between">
            <span className="text-3xl font-extrabold text-purple-700">{account.pointsBalance} pts</span>
            <span className={`text-xs font-semibold px-2 py-0.5 rounded-md border ${
              isTenureUnlocked 
                ? 'text-emerald-700 bg-emerald-50 border-emerald-200' 
                : 'text-amber-700 bg-amber-50 border-amber-200'
            }`}>
              {isTenureUnlocked ? 'Redemptions Active' : 'Tenure Lock'}
            </span>
          </div>
          <p className="text-xs text-slate-600">
            Active member for {account.consecutiveMonths} months ({isTenureUnlocked ? 'Unlocked!' : `Requires ${config.tenureMinMonths} months`})
          </p>
        </div>
      </div>

      {/* REQUESTS LIST WITH ONGOING / PAST TOGGLE BUTTONS */}
      <div className="space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-200 pb-4">
          <div>
            <h3 className="text-lg font-black text-slate-900 flex items-center gap-2">
              <Clock className="w-5 h-5 text-[#0286cd]" />
              Emergency Call-outs & Service Logs
            </h3>
            <p className="text-xs text-slate-600">Track ongoing SLA dispatches and view past service completion history</p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            {/* Two Filter Toggle Buttons for Ongoing & Past */}
            <div className="bg-slate-100 p-1 rounded-2xl border border-slate-300 flex items-center gap-1">
              <button
                onClick={() => setRequestListTab('ongoing')}
                className={`px-3.5 py-1.5 rounded-xl text-xs font-black flex items-center gap-1.5 transition-all cursor-pointer ${
                  requestListTab === 'ongoing'
                    ? 'bg-[#0286cd] text-white shadow-sm'
                    : 'text-slate-700 hover:text-slate-900 font-semibold'
                }`}
              >
                <Zap className="w-3.5 h-3.5" />
                <span>Ongoing Requests ({ongoingJobs.length})</span>
              </button>
              <button
                onClick={() => setRequestListTab('past')}
                className={`px-3.5 py-1.5 rounded-xl text-xs font-black flex items-center gap-1.5 transition-all cursor-pointer ${
                  requestListTab === 'past'
                    ? 'bg-[#0286cd] text-white shadow-sm'
                    : 'text-slate-700 hover:text-slate-900 font-semibold'
                }`}
              >
                <FileText className="w-3.5 h-3.5" />
                <span>Past Records ({pastJobs.length})</span>
              </button>
            </div>

            <button
              onClick={() => isCalloutsExhausted ? setShowChangePlanModal(true) : setShowNewRequestModal(true)}
              className={`font-extrabold px-3.5 py-2 rounded-xl text-xs flex items-center gap-1.5 shadow-md transition-all cursor-pointer ${
                isCalloutsExhausted ? 'bg-amber-600 hover:bg-amber-500 text-white' : 'bg-[#0286cd] hover:bg-[#026fa8] text-white'
              }`}
            >
              {isCalloutsExhausted ? <AlertTriangle className="w-4 h-4 text-white" /> : <Plus className="w-4 h-4" />}
              {isCalloutsExhausted ? '0 CALL-OUTS REMAINING' : 'NEW REQUEST'}
            </button>
          </div>
        </div>

        {displayedJobs.length > 0 ? (
          <div className="custom-scroll-container space-y-6">
            {displayedJobs.map((job, idx) => {
              const photos = Array.isArray(job.photos) ? job.photos : JSON.parse(job.photosJson || '[]');
              const videos = Array.isArray(job.videos) ? job.videos : JSON.parse(job.videosJson || '[]');
              const formattedStatus = (job.status || 'SUBMITTED').replace(/_/g, ' ');
              const isAcceptedOrCompleted = ['ACCEPTED', 'TECHNICIAN_ASSIGNED', 'TRAVELLING', 'ARRIVED', 'IN_PROGRESS', 'COMPLETED', 'REPORT_ISSUED', 'CLOSED'].includes(job.status);
              
              // Determine active step index (1..5)
              const isAccepted = ['ACCEPTED', 'TECH_ASSIGNED', 'TRAVELLING', 'ARRIVED', 'IN_PROGRESS', 'COMPLETED', 'REPORT_ISSUED', 'CLOSED'].includes(job.status) || Boolean(job.technicianName && job.technicianName !== 'Unassigned');
              
              let activeStepIndex = 1;
              if (isAccepted) activeStepIndex = 2;
              if (['TECH_ASSIGNED', 'TRAVELLING', 'ARRIVED', 'IN_PROGRESS', 'COMPLETED', 'REPORT_ISSUED', 'CLOSED'].includes(job.status) && Boolean(job.technicianName && job.technicianName !== 'Unassigned')) activeStepIndex = 3;
              if (['IN_PROGRESS', 'COMPLETED', 'REPORT_ISSUED', 'CLOSED'].includes(job.status)) activeStepIndex = 4;
              if (['COMPLETED', 'REPORT_ISSUED', 'CLOSED'].includes(job.status)) activeStepIndex = 5;

              return (
                <div key={job.id} className="bg-white p-6 rounded-3xl space-y-6 border border-slate-200 shadow-md hover:shadow-lg transition-all relative">
                  <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-200 pb-4">
                    <div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-xs font-mono font-extrabold text-[#0286cd] bg-blue-50 px-3 py-1 rounded-lg border border-blue-200">
                          {job.jobNumber || job.id}
                        </span>
                        <span className={`text-xs px-3 py-1.5 rounded-lg font-black tracking-wide inline-flex items-center gap-1.5 shadow-sm ${
                          ['COMPLETED', 'REPORT_ISSUED', 'CLOSED'].includes(job.status) ? 'bg-emerald-700 text-white border border-emerald-800' :
                          job.status === 'IN_PROGRESS' ? 'bg-amber-500 text-white border border-amber-600 animate-pulse shadow-md' :
                          job.status === 'ARRIVED' ? 'bg-purple-600 text-white border border-purple-700 animate-pulse shadow-md' :
                          job.status === 'TRAVELLING' ? 'bg-indigo-600 text-white border border-indigo-700 animate-pulse shadow-md' :
                          job.status === 'ACCEPTED' ? 'bg-emerald-100 text-emerald-900 border border-emerald-300' :
                          job.status === 'TECH_ASSIGNED' ? 'bg-blue-100 text-blue-900 border border-blue-300' :
                          'bg-slate-100 text-slate-800 border border-slate-300'
                        }`}>
                          {['COMPLETED', 'REPORT_ISSUED', 'CLOSED'].includes(job.status) ? '🎉 COMPLETED' :
                           job.status === 'IN_PROGRESS' ? '🧹 CLEANING IN PROGRESS' :
                           job.status === 'ARRIVED' ? '📍 TECHNICIAN ARRIVED ON SITE' :
                           job.status === 'TRAVELLING' ? '🚗 TECHNICIAN EN ROUTE (Travelling)' :
                           job.status === 'ACCEPTED' ? '✅ ACCEPTED BY TECHNICIAN' :
                           job.status === 'TECH_ASSIGNED' ? '👤 ADMIN DISPATCHED TO TECHNICIAN' :
                           '⏳ SUBMITTED (Awaiting Acceptance)'}
                        </span>
                        <span className="text-[11px] font-semibold text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded-lg border border-emerald-200">
                          ✓ Monthly Included Call-out #{idx + 1}
                        </span>
                      </div>
                      <h3 className="text-lg font-extrabold text-slate-900 mt-2">{job.category} Emergency</h3>
                      <p className="text-xs text-slate-600 font-medium">📍 {job.locationName || 'Site Location'} • {job.address}</p>
                      {job.description && (
                        <p className="text-xs text-slate-700 bg-slate-50 p-3 rounded-xl border border-slate-200 mt-2 font-normal">
                          "{job.description}"
                        </p>
                      )}
                    </div>

                    <div className="text-right space-y-2">
                      <div className="bg-slate-50 p-3.5 rounded-2xl border border-slate-200">
                        <div className="text-xs text-slate-500 font-semibold">Target Attendance Time</div>
                        <div className="text-xs sm:text-sm font-extrabold text-[#0286cd] flex items-center gap-1.5 justify-end mt-0.5">
                          <Clock className="w-4 h-4 text-[#0286cd]" />
                          Within 2–4 Hours (On Schedule)
                        </div>
                      </div>

                      {/* PDF Completion Report & Download Option Buttons */}
                      {['COMPLETED', 'REPORT_ISSUED', 'CLOSED'].includes(job.status) ? (
                        <div className="flex flex-col gap-1.5 w-full">
                          <button
                            onClick={() => openPrintableReport(job.id)}
                            className="w-full bg-[#0286cd] hover:bg-[#026fa8] text-white font-extrabold py-2 px-3 rounded-xl text-xs flex items-center justify-center gap-1.5 transition-all shadow cursor-pointer"
                          >
                            <FileText className="w-3.5 h-3.5 text-white" />
                            <span>View PDF Report</span>
                          </button>
                          <button
                            onClick={() => handleDownloadPdfReport(job.id, job.jobNumber)}
                            className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold py-2 px-3 rounded-xl text-xs flex items-center justify-center gap-1.5 transition-all shadow cursor-pointer"
                          >
                            <Download className="w-3.5 h-3.5 text-white" />
                            <span>📥 Download</span>
                          </button>
                        </div>
                      ) : (
                        <div className="space-y-1.5">
                          {(job.status === 'NEW' || job.status === 'SUBMITTED') && (
                            <button
                              onClick={() => setEditingJob(job)}
                              className="w-full bg-slate-800 hover:bg-slate-900 text-white font-bold py-1.5 px-3 rounded-xl text-xs flex items-center justify-center gap-1.5 transition-all shadow cursor-pointer border border-slate-700"
                            >
                              <Edit3 className="w-3.5 h-3.5 text-amber-400" />
                              <span>Edit Request Details</span>
                            </button>
                          )}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* DEDICATED TECHNICIAN ARRIVED ON SITE ALERT CARD */}
                  {job.status === 'ARRIVED' && (
                    <div className="bg-purple-900 p-4.5 rounded-3xl text-white space-y-2 shadow-xl border-2 border-purple-400 animate-pulse">
                      <div className="flex items-center gap-3">
                        <div className="p-2 bg-purple-700 rounded-2xl">
                          <MapPin className="w-6 h-6 text-white" />
                        </div>
                        <div>
                          <div className="text-xs font-black text-purple-200 uppercase tracking-wider">Arrival Notification</div>
                          <h4 className="text-base font-black text-white">
                            📍 Technician {job.technicianName || 'Dave Miller'} Has Arrived On Site!
                          </h4>
                        </div>
                      </div>
                      <p className="text-xs text-purple-100 font-medium pl-11">
                        Technician is present at <strong>{job.locationName || 'your site location'}</strong> (Parked at loading dock/visitor bay). Preparing emergency cleaning equipment to commence work.
                      </p>
                    </div>
                  )}

                  {/* LIVE TECHNICIAN GPS LOCATION & LIVE ETA BANNER WITH INTERACTIVE MAP */}
                  {['TRAVELLING', 'ARRIVED', 'IN_PROGRESS'].includes(job.status) && (
                    <div className="bg-gradient-to-r from-blue-900 via-indigo-900 to-slate-900 p-4.5 rounded-3xl text-white space-y-3.5 shadow-xl border border-blue-700/50">
                      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-blue-800/80 pb-2.5">
                        <div className="flex items-center gap-2">
                          <span className="relative flex h-3.5 w-3.5">
                            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                            <span className="relative inline-flex rounded-full h-3.5 w-3.5 bg-emerald-500"></span>
                          </span>
                          <span className="text-xs font-black text-emerald-400 uppercase tracking-wider">
                            {job.status === 'TRAVELLING' ? '🟢 LIVE GPS DISPATCH TRACKING' : job.status === 'ARRIVED' ? '📍 TECHNICIAN ARRIVED ON-SITE' : '🧹 CLEANING IN PROGRESS'}
                          </span>
                        </div>
                        <span className="text-[11px] font-extrabold text-purple-200 bg-purple-950/90 px-3 py-1 rounded-lg border border-purple-700/60">
                          Live Status: {job.status === 'TRAVELLING' ? '14 Mins (In Transit)' : job.status === 'ARRIVED' ? '📍 On Site Now' : 'Active Service'}
                        </span>
                      </div>

                      <div className="flex flex-wrap items-center justify-between gap-3 text-xs">
                        <div>
                          <div className="text-[10px] text-blue-300 font-bold uppercase tracking-wider">Assigned Dispatch Technician</div>
                          <div className="font-extrabold text-white text-sm flex items-center gap-1.5 mt-0.5">
                            <User className="w-4 h-4 text-[#0286cd]" />
                            {job.technicianName || 'Dave Miller (Tech ID #104)'}
                          </div>
                          <p className="text-[11px] text-slate-300 mt-1">
                            📍 Live Location: {job.status === 'TRAVELLING' ? 'En route on Grenfell St & King William St, Adelaide CBD (1.4 km away)' : 'Parked at Loading Dock Bay 3'}
                          </p>
                        </div>

                        <div className="flex flex-wrap items-center gap-2">
                          <button
                            onClick={() => setSelectedJobForLiveMap(job)}
                            className="bg-[#0286cd] hover:bg-[#026fa8] text-white font-extrabold px-3.5 py-2 rounded-xl text-xs flex items-center gap-1.5 shadow transition-all cursor-pointer animate-pulse"
                          >
                            <MapPin className="w-4 h-4" />
                            <span>🗺️ View Live GPS Map</span>
                          </button>

                          <a
                            href={`tel:${job.onsitePhone || '0488111222'}`}
                            className="bg-emerald-600 hover:bg-emerald-500 text-white font-extrabold px-3.5 py-2 rounded-xl text-xs flex items-center gap-1.5 shadow transition-all"
                          >
                            <Phone className="w-3.5 h-3.5" /> Call Tech Direct
                          </a>
                        </div>
                      </div>

                      {/* Embedded Interactive Map Preview for Customer */}
                      <div className="relative h-44 rounded-2xl overflow-hidden border border-blue-700/60 shadow-inner">
                        <iframe
                          title="Customer Live Map Preview"
                          width="100%"
                          height="100%"
                          frameBorder="0"
                          scrolling="no"
                          src={`https://maps.google.com/maps?q=${encodeURIComponent(job.address || 'King William St, Adelaide CBD')}&t=&z=15&ie=UTF8&iwloc=&output=embed`}
                          className="w-full h-full opacity-90 filter contrast-125 pointer-events-none"
                        ></iframe>
                        <div
                          onClick={() => setSelectedJobForLiveMap(job)}
                          className="absolute inset-0 bg-slate-900/30 hover:bg-slate-900/10 cursor-pointer transition-all flex items-center justify-center"
                        >
                          <span className="bg-slate-900/90 text-white font-black px-4 py-2 rounded-xl text-xs shadow-2xl border border-slate-700 flex items-center gap-2">
                            <MapPin className="w-4 h-4 text-[#0286cd]" />
                            <span>Click to Expand Fullscreen Live Map</span>
                          </span>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Technician & Onsite Info */}
                  {job.technicianName && (
                    <div className="bg-blue-50/50 p-3 rounded-2xl border border-blue-100 flex items-center justify-between text-xs">
                      <span className="font-semibold text-slate-700">Dispatch Technician: <strong className="text-slate-900">{job.technicianName}</strong></span>
                      <span className="text-emerald-700 font-bold bg-emerald-100 px-2 py-0.5 rounded border border-emerald-200 text-[10px]">
                        ✓ Attendance SLA On Track
                      </span>
                    </div>
                  )}

                  {/* Live Response Timeline (7 Full Stages) */}
                  <div className="space-y-2">
                    <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider">Live Response 7-Stage SLA Timeline</h4>
                    <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-7 gap-1.5 text-center text-[10px] sm:text-[11px]">
                      <div className={`p-2 rounded-xl font-bold border transition-all ${
                        ['SUBMITTED', 'NEW', 'TECH_ASSIGNED', 'ACCEPTED', 'TRAVELLING', 'ARRIVED', 'IN_PROGRESS', 'COMPLETED', 'REPORT_ISSUED', 'CLOSED'].includes(job.status)
                          ? 'bg-emerald-50 border-emerald-300 text-emerald-800' : 'bg-slate-50 border-slate-200 text-slate-400'
                      }`}>
                        1. Submitted
                      </div>
                      <div className={`p-2 rounded-xl font-bold border transition-all ${
                        ['TECH_ASSIGNED', 'ACCEPTED', 'TRAVELLING', 'ARRIVED', 'IN_PROGRESS', 'COMPLETED', 'REPORT_ISSUED', 'CLOSED'].includes(job.status) && Boolean(job.technicianName && job.technicianName !== 'Unassigned')
                          ? 'bg-emerald-50 border-emerald-300 text-emerald-800' : 'bg-slate-50 border-slate-200 text-slate-400'
                      }`}>
                        2. Admin Dispatched
                      </div>
                      <div className={`p-2 rounded-xl font-bold border transition-all ${
                        ['ACCEPTED', 'TRAVELLING', 'ARRIVED', 'IN_PROGRESS', 'COMPLETED', 'REPORT_ISSUED', 'CLOSED'].includes(job.status)
                          ? 'bg-emerald-50 border-emerald-300 text-emerald-800' : 'bg-slate-50 border-slate-200 text-slate-400'
                      }`}>
                        3. Tech Accepted
                      </div>
                      <div className={`p-2 rounded-xl font-bold border transition-all ${
                        job.status === 'TRAVELLING' ? 'bg-indigo-600 border-indigo-700 text-white font-extrabold animate-pulse shadow-md' :
                        ['ARRIVED', 'IN_PROGRESS', 'COMPLETED', 'REPORT_ISSUED', 'CLOSED'].includes(job.status) ? 'bg-emerald-50 border-emerald-300 text-emerald-800' : 'bg-slate-50 border-slate-200 text-slate-400'
                      }`}>
                        4. Travelling
                      </div>
                      <div className={`p-2 rounded-xl font-bold border transition-all ${
                        job.status === 'ARRIVED' ? 'bg-purple-600 border-purple-700 text-white font-extrabold animate-pulse shadow-md' :
                        ['IN_PROGRESS', 'COMPLETED', 'REPORT_ISSUED', 'CLOSED'].includes(job.status) ? 'bg-emerald-50 border-emerald-300 text-emerald-800' : 'bg-slate-50 border-slate-200 text-slate-400'
                      }`}>
                        5. Arrived
                      </div>
                      <div className={`p-2 rounded-xl font-bold border transition-all ${
                        job.status === 'IN_PROGRESS' ? 'bg-amber-500 border-amber-600 text-white font-extrabold animate-pulse shadow-md' :
                        ['COMPLETED', 'REPORT_ISSUED', 'CLOSED'].includes(job.status) ? 'bg-emerald-50 border-emerald-300 text-emerald-800' : 'bg-slate-50 border-slate-200 text-slate-400'
                      }`}>
                        6. Cleaning Active
                      </div>
                      <div className={`p-2 rounded-xl font-bold border transition-all ${
                        ['COMPLETED', 'REPORT_ISSUED', 'CLOSED'].includes(job.status) ? 'bg-emerald-600 border-emerald-700 text-white font-extrabold shadow-md' : 'bg-slate-50 border-slate-200 text-slate-400'
                      }`}>
                        7. Completed
                      </div>
                    </div>
                  </div>

                  {/* Photos & Videos Media Gallery */}
                  {(photos.length > 0 || videos.length > 0) && (
                    <div className="space-y-3 pt-2 border-t border-slate-100">
                      {photos.length > 0 && (
                        <div>
                          <h4 className="text-xs font-extrabold text-slate-600 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                            <Camera className="w-3.5 h-3.5 text-[#0286cd]" /> Uploaded Incident Photos ({photos.length})
                          </h4>
                          <div className="flex gap-3 overflow-x-auto pb-1">
                            {photos.map((src, i) => (
                              <a key={i} href={src} target="_blank" rel="noopener noreferrer" className="flex-shrink-0 group">
                                <img src={src} alt={`Incident Photo ${i+1}`} className="w-24 h-24 object-cover rounded-2xl border border-slate-200 shadow-sm group-hover:scale-105 transition-all" />
                              </a>
                            ))}
                          </div>
                        </div>
                      )}

                      {videos.length > 0 && (
                        <div>
                          <h4 className="text-xs font-extrabold text-slate-600 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                            <Play className="w-3.5 h-3.5 text-purple-600 fill-purple-600" /> Uploaded Short Video Clips ({videos.length})
                          </h4>
                          <div className="flex gap-3 overflow-x-auto pb-1">
                            {videos.map((src, i) => (
                              <div key={i} className="bg-slate-900 p-2 rounded-2xl text-white text-xs space-y-1.5 w-52 flex-shrink-0 border border-slate-800 shadow-md">
                                <div className="flex items-center justify-between font-bold text-purple-300 text-[11px]">
                                  <span className="flex items-center gap-1"><Play className="w-3 h-3 fill-purple-300" /> Video #{i + 1}</span>
                                  <span className="text-[9px] text-slate-400 font-mono">MP4/WebM</span>
                                </div>
                                {src.startsWith('data:video') || src.endsWith('.mp4') || src.endsWith('.webm') || src.includes('mixkit') || src.includes('video') ? (
                                  <video src={src} controls className="w-full h-28 rounded-xl object-cover bg-black" />
                                ) : (
                                  <a href={src} target="_blank" rel="noopener noreferrer" className="text-[10px] text-blue-400 underline font-mono truncate block p-2 bg-slate-800 rounded-lg">
                                    🔗 Open Video Media Link
                                  </a>
                                )}
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        ) : (
          <div className="bg-white p-8 rounded-3xl text-center text-slate-500 text-xs border border-slate-200 shadow-sm space-y-3">
            <p>{requestListTab === 'ongoing' ? 'No ongoing emergency requests currently in progress.' : 'No past callout records found for this business account.'}</p>
            {requestListTab === 'ongoing' && (
              <button
                onClick={() => setShowNewRequestModal(true)}
                className="bg-[#0286cd] text-[#ffffff] font-extrabold px-4 py-2 rounded-xl text-xs inline-flex items-center gap-1.5 shadow"
              >
                <Plus className="w-4 h-4" /> Create Emergency Request
              </button>
            )}
          </div>
        )}
      </div>

      {/* Reward Points Redemption Banner */}
      <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-md flex flex-col md:flex-row items-center justify-between gap-6">
        <div className="space-y-1">
          <div className="text-xs font-bold text-purple-700 uppercase tracking-wider flex items-center gap-1.5">
            <Award className="w-4 h-4" />
            Emergency Reward Points Catalog
          </div>
          <h3 className="text-lg font-bold text-slate-900">Redeem Accumulated Points for Free Periodical Cleaning</h3>
          <p className="text-xs text-slate-600">Steam cleaning, pressure washing, tile & grout, deep cleaning & high dusting.</p>
        </div>
        <button
          onClick={() => setShowRedemptionModal(true)}
          className="bg-purple-700 hover:bg-purple-800 text-white font-bold py-2.5 px-5 rounded-xl text-xs whitespace-nowrap shadow transition-all cursor-pointer"
        >
          REDEEM MY POINTS
        </button>
      </div>

      {/* Service Locations Section */}
      <div className="bg-white p-6 rounded-3xl space-y-4 border border-slate-200 shadow-md">
        <div className="flex items-center justify-between border-b border-slate-200 pb-3">
          <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
            <Building className="w-4 h-4 text-[#0286cd]" />
            Registered Service Locations
          </h3>
          <span className="text-xs text-slate-500 font-semibold">{(account.locations || []).length} Sites</span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {(account.locations || []).map(loc => (
            <div key={loc.id} className="p-4 rounded-2xl bg-slate-50 border border-slate-200 space-y-2">
              <div className="font-bold text-xs text-slate-900">{loc.name}</div>
              <p className="text-[11px] text-slate-600">{loc.address}</p>
              <div className="text-[10px] text-slate-700 bg-white p-2.5 rounded-xl border border-slate-200 font-mono">
                🔑 Access: {loc.accessInstructions}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* MODAL: LIVE TECHNICIAN GPS LOCATION MAP FOR CUSTOMER */}
      {selectedJobForLiveMap && (
        <LiveTechnicianMapModal
          job={selectedJobForLiveMap}
          onClose={() => setSelectedJobForLiveMap(null)}
        />
      )}
    </div>
  );
}

/* =========================================================================
   CHANGE PLAN MODAL COMPONENT
   ========================================================================= */
function ChangePlanModal({ account, activePlan, config, onClose, onPlanChangeSuccess }) {
  const [selectedPlanId, setSelectedPlanId] = useState(account.membershipPlan || 'business');
  const [loading, setLoading] = useState(false);

  const handleSavePlan = async () => {
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/customers/${account.id}/plan`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ membershipPlan: selectedPlanId })
      });
      const data = await res.json();
      if (data.customer) {
        onPlanChangeSuccess(data.customer);
      } else {
        onPlanChangeSuccess({ ...account, membershipPlan: selectedPlanId });
      }
    } catch (e) {
      onPlanChangeSuccess({ ...account, membershipPlan: selectedPlanId });
    }
    setLoading(false);
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-4">
      <div className="bg-white max-w-xl w-full p-6 rounded-3xl space-y-6 border border-slate-200 shadow-2xl text-xs text-slate-800">
        <div className="flex items-center justify-between border-b border-slate-200 pb-3">
          <h3 className="text-lg font-bold text-slate-900 flex items-center gap-2">
            <Shield className="w-5 h-5 text-[#0286cd]" />
            Change Membership Package
          </h3>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-700 cursor-pointer"><X className="w-5 h-5" /></button>
        </div>

        <p className="text-slate-600">Choose a new emergency cleaning membership plan for <strong>{account.businessName}</strong>:</p>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {(config.membershipPlans || []).map(plan => (
            <div
              key={plan.id}
              onClick={() => setSelectedPlanId(plan.id)}
              className={`p-4 rounded-2xl border-2 cursor-pointer transition-all space-y-2 ${
                selectedPlanId === plan.id 
                  ? 'border-[#0286cd] bg-blue-50/50 shadow-md ring-2 ring-[#0286cd]/20' 
                  : 'border-slate-200 bg-slate-50 hover:border-slate-300'
              }`}
            >
              <div className="font-extrabold text-slate-900 text-sm">{plan.name}</div>
              <div className="text-xl font-black text-[#0286cd]">${plan.price}<span className="text-xs text-slate-500 font-normal">/mo</span></div>
              <p className="text-[11px] text-slate-600">{plan.callouts} Call-out(s) included</p>
            </div>
          ))}
        </div>

        <div className="pt-2 flex gap-3">
          <button onClick={onClose} className="flex-1 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold py-3 rounded-xl cursor-pointer">
            Cancel
          </button>
          <button
            onClick={handleSavePlan}
            disabled={loading}
            className="flex-1 bg-[#0286cd] hover:bg-[#026fa8] text-white font-extrabold py-3 rounded-xl shadow-md transition-all cursor-pointer"
          >
            {loading ? 'Updating Plan...' : 'Confirm Plan Change'}
          </button>
        </div>
      </div>
    </div>
  );
}

/* =========================================================================
   CALLOUT EXPLANATION MODAL
   ========================================================================= */
function CalloutExplanationModal({ account, activePlan, config, onClose }) {
  const calloutsRemaining = Math.max(0, (activePlan?.callouts || 2) - account.calloutsUsed);

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-4">
      <div className="bg-white max-w-lg w-full p-6 rounded-3xl space-y-5 border border-slate-200 shadow-2xl text-xs text-slate-800">
        <div className="flex items-center justify-between border-b border-slate-200 pb-3">
          <h3 className="text-lg font-bold text-slate-900 flex items-center gap-2">
            <AlertCircle className="w-5 h-5 text-[#0286cd]" />
            How Membership Call-Outs Work
          </h3>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-700 cursor-pointer"><X className="w-5 h-5" /></button>
        </div>

        <div className="space-y-3 text-slate-600">
          <div className="p-3 bg-blue-50/60 rounded-2xl border border-blue-200 space-y-1">
            <div className="font-bold text-[#0286cd]">1. Included Call-Outs Allowance</div>
            <p>Your <strong>{activePlan?.name} Plan (${activePlan?.price}/mo)</strong> includes <strong>{activePlan?.callouts} call-out(s) per month</strong>. Each included call-out provides up to 1 hour of emergency cleaning labour at $0 extra charge.</p>
          </div>

          <div className="p-3 bg-emerald-50/60 rounded-2xl border border-emerald-200 space-y-1">
            <div className="font-bold text-emerald-700">2. Current Balance: {calloutsRemaining} / {activePlan?.callouts} Call-out(s) Remaining</div>
            <p>You have used {account.calloutsUsed} out of your {activePlan?.callouts} included call-out(s) for this monthly billing cycle. Your balance automatically resets in 12 days.</p>
          </div>

          <div className="p-3 bg-amber-50/60 rounded-2xl border border-amber-200 space-y-1">
            <div className="font-bold text-amber-800">3. What if all call-outs are used (0 remaining)?</div>
            <p>You can still request emergency cleaning anytime! Additional call-outs incur a <strong>${config.additionalCalloutFee} additional call-out fee</strong> + standard hourly labour rates (${config.overageHourlyRate}/hr).</p>
          </div>
        </div>

        <button 
          onClick={onClose}
          className="w-full bg-[#0286cd] hover:bg-[#026fa8] text-white font-extrabold py-3 rounded-xl transition-all shadow-md cursor-pointer"
        >
          Got It, Thanks!
        </button>
      </div>
    </div>
  );
}

/* =========================================================================
   TECHNICIAN MOBILE APP COMPONENT
   ========================================================================= */
/* =========================================================================
   TECHNICIAN PROFILE MODAL COMPONENT
   ========================================================================= */
/* =========================================================================
   TECHNICIAN PROFILE MODAL COMPONENT (EDITABLE PROFILE)
   ========================================================================= */
function TechnicianProfileModal({ currentUser, onUpdateUser, onClose, handleLogout }) {
  const [name, setName] = useState(currentUser?.name || 'Dave Miller');
  const [phone, setPhone] = useState(currentUser?.phone || '0488 111 222');
  const [email, setEmail] = useState(currentUser?.email || 'dave.m@sacommercialcleaning.com.au');
  const [depot, setDepot] = useState(currentUser?.depot || 'Adelaide CBD Service Depot');
  const [avatar, setAvatar] = useState(currentUser?.avatar || 'https://images.unsplash.com/photo-1560250097-0b93528c311a?auto=format&fit=crop&w=150&q=80');
  const [password, setPassword] = useState('');
  const [savedSuccess, setSavedSuccess] = useState(false);
  const [profileError, setProfileError] = useState('');

  const handleSaveProfile = async (e) => {
    e.preventDefault();
    setProfileError('');
    try {
      const techId = currentUser?.techId || currentUser?.id;
      const res = await fetch(`${API_BASE}/technicians/${techId}/profile`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, phone, password: password || undefined })
      });
      const data = await res.json();
      if (res.ok) {
        const updated = {
          ...currentUser,
          name,
          phone,
          avatar
        };
        if (onUpdateUser) onUpdateUser(updated);
        setSavedSuccess(true);
        setTimeout(() => {
          setSavedSuccess(false);
          onClose();
        }, 1200);
      } else {
        setProfileError(data.error || 'Failed to update technician profile.');
      }
    } catch (err) {
      setProfileError('Network error: Unable to reach server.');
    }
  };

  const handlePhotoUpload = (e) => {
    const file = e.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setAvatar(reader.result);
      };
      reader.readAsDataURL(file);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-white max-w-lg w-full p-6 rounded-3xl space-y-4 border border-slate-200 shadow-2xl text-xs text-slate-800 max-h-[90vh] overflow-y-auto custom-scroll-container">
        <div className="flex items-center justify-between border-b border-slate-200 pb-3">
          <h3 className="text-lg font-extrabold text-slate-900 flex items-center gap-2">
            <User className="w-5 h-5 text-[#0286cd]" />
            Edit Field Technician Profile
          </h3>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-700 cursor-pointer"><X className="w-5 h-5" /></button>
        </div>

        {savedSuccess && (
          <div className="bg-emerald-100 border border-emerald-300 text-emerald-900 p-3 rounded-2xl text-xs font-bold text-center flex items-center justify-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-600" /> Profile successfully updated & saved!
          </div>
        )}

        <form onSubmit={handleSaveProfile} className="space-y-4">
          <div className="flex items-center gap-4 bg-slate-50 p-4 rounded-2xl border border-slate-200">
            <div className="relative shrink-0">
              <img src={avatar} alt="Profile" className="w-16 h-16 rounded-2xl object-cover border border-slate-300 shadow-sm" />
              <label className="absolute -bottom-1 -right-1 bg-[#0286cd] text-white p-1 rounded-full cursor-pointer hover:bg-[#026fa8] shadow">
                <UploadCloud className="w-3.5 h-3.5" />
                <input type="file" accept="image/*" onChange={handlePhotoUpload} className="hidden" />
              </label>
            </div>
            <div className="flex-1 space-y-1">
              <label className="block text-[11px] font-bold text-slate-700">Avatar Photo URL</label>
              <input
                type="text"
                value={avatar}
                onChange={(e) => setAvatar(e.target.value)}
                placeholder="Paste avatar URL..."
                className="w-full bg-white border border-slate-300 rounded-xl p-2 text-xs font-medium text-slate-900"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-slate-700 font-bold mb-1">Technician Full Name</label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
                className="w-full bg-white border border-slate-300 rounded-xl p-2.5 text-xs font-bold text-slate-900"
              />
            </div>

            <div>
              <label className="block text-slate-700 font-bold mb-1">Mobile Phone Number</label>
              <input
                type="text"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                required
                className="w-full bg-white border border-slate-300 rounded-xl p-2.5 text-xs font-bold text-slate-900"
              />
            </div>

            <div>
              <label className="block text-slate-700 font-bold mb-1">Email Address</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="w-full bg-white border border-slate-300 rounded-xl p-2.5 text-xs font-bold text-slate-900"
              />
            </div>

            <div>
              <label className="block text-slate-700 font-bold mb-1">Base Dispatch Depot</label>
              <input
                type="text"
                value={depot}
                onChange={(e) => setDepot(e.target.value)}
                required
                className="w-full bg-white border border-slate-300 rounded-xl p-2.5 text-xs font-bold text-slate-900"
              />
            </div>
          </div>

          <div>
            <label className="block text-slate-700 font-bold mb-1">Update Security Password (Optional)</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Leave blank to keep current password"
              className="w-full bg-white border border-slate-300 rounded-xl p-2.5 text-xs font-medium text-slate-900"
            />
          </div>

          <div className="pt-2 flex gap-3">
            <button
              type="button"
              onClick={handleLogout}
              className="bg-red-600 hover:bg-red-500 text-white font-extrabold px-4 py-3 rounded-xl shadow cursor-pointer text-xs flex items-center gap-1.5"
            >
              <X className="w-4 h-4" /> Log Out
            </button>
            <button
              type="button"
              onClick={onClose}
              className="bg-slate-200 hover:bg-slate-300 text-slate-800 font-bold px-4 py-3 rounded-xl text-xs cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="flex-1 bg-[#0286cd] hover:bg-[#026fa8] text-white font-extrabold py-3 rounded-xl shadow-lg transition-all text-xs flex items-center justify-center gap-1.5 cursor-pointer"
            >
              <CheckCircle2 className="w-4 h-4 text-white" /> Save Profile Changes
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

/* =========================================================================
   TECHNICIAN FIELD DISPATCH MOBILE APP COMPONENT
   ========================================================================= */
function TechnicianApp({ jobs, setJobs, currentUser, setCurrentUser, handleLogout, showProfileModal: parentShowProfileModal, setShowProfileModal: parentSetShowProfileModal }) {
  const [techTab, setTechTab] = useState('assigned'); // 'assigned' vs 'ongoing' vs 'completed'
  const [internalShowProfileModal, setInternalShowProfileModal] = useState(false);
  const [showSettingsMenu, setShowSettingsMenu] = useState(false);

  const showProfileModal = parentShowProfileModal !== undefined ? parentShowProfileModal : internalShowProfileModal;
  const setShowProfileModal = parentSetShowProfileModal || setInternalShowProfileModal;
  
  // 1. Assigned Requests (Dispatched by Admin, awaiting technician acceptance)
  const assignedJobs = jobs.filter(j => {
    const isAssigned = Boolean(j.technicianName && j.technicianName !== 'Unassigned');
    let isForThisTech = true;
    if (currentUser?.role === 'technician' && currentUser?.name) {
      isForThisTech = j.technicianName.toLowerCase().includes(currentUser.name.toLowerCase());
    }
    const isAwaitingAccept = ['NEW', 'SUBMITTED', 'TECH_ASSIGNED'].includes(j.status);
    return isAssigned && isForThisTech && isAwaitingAccept;
  });

  // 2. Ongoing Requests (Accepted by technician, actively ongoing: ACCEPTED, TRAVELLING, ARRIVED, IN_PROGRESS)
  const ongoingJobs = jobs.filter(j => {
    const isAssigned = Boolean(j.technicianName && j.technicianName !== 'Unassigned');
    let isForThisTech = true;
    if (currentUser?.role === 'technician' && currentUser?.name) {
      isForThisTech = j.technicianName.toLowerCase().includes(currentUser.name.toLowerCase());
    }
    const isOngoingState = ['ACCEPTED', 'TRAVELLING', 'ARRIVED', 'IN_PROGRESS'].includes(j.status);
    return isAssigned && isForThisTech && isOngoingState;
  });

  // 3. Completed Records
  const completedJobs = jobs.filter(j => {
    const isAssigned = Boolean(j.technicianName && j.technicianName !== 'Unassigned');
    let isForThisTech = true;
    if (currentUser?.role === 'technician' && currentUser?.name) {
      isForThisTech = j.technicianName.toLowerCase().includes(currentUser.name.toLowerCase());
    }
    const isCompleted = ['COMPLETED', 'REPORT_ISSUED', 'CLOSED'].includes(j.status);
    return isAssigned && isForThisTech && isCompleted;
  });

  const handleStatusUpdate = async (jobId, newStatus) => {
    // The screen only changes after the server has saved the new status
    try {
      const res = await fetch(`${API_BASE}/jobs/${jobId}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus })
      });
      const data = await res.json();
      if (!res.ok) {
        alert(data.error || 'The status could not be updated.');
        return;
      }
      setJobs(prev => prev.map(j => j.id === jobId ? data : j));
    } catch (e) {
      alert('Network error: Unable to reach the server. The status was not changed.');
    }
  };

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      {/* Technician Header Card with Settings Gear */}
      <div className="bg-white p-5 rounded-3xl border border-slate-200 shadow-md flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="relative">
            <img src={currentUser?.avatar || 'https://images.unsplash.com/photo-1560250097-0b93528c311a?auto=format&fit=crop&w=150&q=80'} alt="Dave Miller" className="w-12 h-12 rounded-2xl object-cover border border-slate-300 shadow-sm" />
            <span className="absolute -bottom-1 -right-1 w-4 h-4 rounded-full bg-emerald-500 border-2 border-white"></span>
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-base font-black text-slate-900">{currentUser?.name || 'Dave Miller'}</h2>
              <span className="text-[10px] bg-blue-50 text-[#0286cd] font-bold px-2 py-0.5 rounded border border-blue-200">Tech ID #104</span>
            </div>
            <p className="text-xs text-slate-500 font-medium">Senior Emergency Field Specialist • Active Dispatch Duty</p>
          </div>
        </div>

        {/* Top-Right Settings Gear Icon Dropdown */}
        <div className="relative">
          <button
            onClick={() => setShowSettingsMenu(!showSettingsMenu)}
            className="p-2.5 rounded-2xl bg-slate-100 hover:bg-slate-200 border border-slate-300 text-slate-700 transition-all cursor-pointer shadow-sm flex items-center gap-2 font-bold text-xs"
          >
            <Settings className="w-5 h-5 text-[#0286cd]" />
            <span>Settings</span>
            <ChevronDown className="w-3.5 h-3.5 text-slate-500" />
          </button>

          {showSettingsMenu && (
            <div className="absolute right-0 mt-2 w-48 bg-white rounded-2xl shadow-2xl border border-slate-200 py-2 z-50 text-xs">
              <button
                onClick={() => { setShowSettingsMenu(false); setShowProfileModal(true); }}
                className="w-full text-left px-4 py-2.5 hover:bg-slate-50 flex items-center gap-2 font-semibold text-slate-800"
              >
                <User className="w-4 h-4 text-[#0286cd]" />
                <span>Profile</span>
              </button>
              <div className="border-t border-slate-100 my-1"></div>
              <button
                onClick={handleLogout}
                className="w-full text-left px-4 py-2.5 hover:bg-red-50 flex items-center gap-2 font-semibold text-red-600"
              >
                <X className="w-4 h-4 text-red-500" />
                <span>Log Out</span>
              </button>
            </div>
          )}
        </div>
      </div>

      {/* 3 Tabs: Assigned Requests, Ongoing Requests, Completed Records */}
      <div className="flex items-center gap-2 bg-slate-100 p-1.5 rounded-2xl border border-slate-300 text-xs">
        <button
          onClick={() => setTechTab('assigned')}
          className={`flex-1 py-2.5 rounded-xl font-black flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
            techTab === 'assigned' ? 'bg-[#0286cd] text-white shadow-md' : 'text-slate-700 hover:text-slate-900 font-bold'
          }`}
        >
          <Zap className="w-4 h-4" />
          <span>Assigned ({assignedJobs.length})</span>
        </button>

        <button
          onClick={() => setTechTab('ongoing')}
          className={`flex-1 py-2.5 rounded-xl font-black flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
            techTab === 'ongoing' ? 'bg-amber-600 text-white shadow-md' : 'text-slate-700 hover:text-slate-900 font-bold'
          }`}
        >
          <Wrench className="w-4 h-4" />
          <span>Ongoing ({ongoingJobs.length})</span>
        </button>

        <button
          onClick={() => setTechTab('completed')}
          className={`flex-1 py-2.5 rounded-xl font-black flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
            techTab === 'completed' ? 'bg-emerald-700 text-white shadow-md' : 'text-slate-700 hover:text-slate-900 font-bold'
          }`}
        >
          <CheckCircle2 className="w-4 h-4" />
          <span>Completed ({completedJobs.length})</span>
        </button>
      </div>

      {/* RENDER ASSIGNED REQUESTS (AWAITING TECHNICIAN ACCEPTANCE) */}
      {techTab === 'assigned' && (
        assignedJobs.length > 0 ? (
          <div className="max-h-[580px] overflow-y-auto pr-1.5 space-y-6 custom-scroll-container">
            {assignedJobs.map(job => {
              const photos = Array.isArray(job.photos) ? job.photos : JSON.parse(job.photosJson || '[]');
              const videos = Array.isArray(job.videos) ? job.videos : JSON.parse(job.videosJson || '[]');

              return (
                <div key={job.id} className="bg-white p-6 rounded-3xl border border-slate-200 shadow-xl space-y-5">
                  <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 pb-4">
                    <div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-xs font-mono font-black text-[#0286cd] bg-blue-50 px-3 py-1 rounded-lg border border-blue-200">
                          {job.jobNumber || job.id}
                        </span>
                        <span className="text-xs px-3 py-1.5 rounded-lg font-black tracking-wide inline-flex items-center gap-1.5 shadow-sm bg-blue-100 text-blue-900 border border-blue-300">
                          ⚡ DISPATCHED TO YOU (Action Required)
                        </span>
                      </div>
                      <h3 className="text-lg font-extrabold text-slate-900 mt-2">{job.category} Emergency</h3>
                      <p className="text-xs text-slate-600 font-medium">📍 {job.locationName || 'Service Site'} • {job.address}</p>
                    </div>

                    <a 
                      href={`https://maps.google.com/?q=${encodeURIComponent(job.address)}`} 
                      target="_blank" 
                      rel="noreferrer"
                      className="bg-[#0286cd] hover:bg-[#026fa8] text-white font-bold px-3.5 py-2 rounded-xl text-xs flex items-center gap-1.5 shadow transition-all"
                    >
                      <MapPin className="w-4 h-4" /> Open Maps Navigation
                    </a>
                  </div>

                  {/* COMPLETE REFERENCE DETAILS */}
                  <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200 space-y-3.5 text-xs text-slate-800">
                    <h4 className="font-black text-slate-900 text-xs uppercase tracking-wider text-[#0286cd] flex items-center gap-1.5">
                      <FileText className="w-4 h-4" /> Complete Incident Reference & Site Info
                    </h4>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3 bg-white p-3 rounded-xl border border-slate-200 font-medium">
                      <div>
                        <span className="text-slate-500 font-semibold block text-[11px]">Customer Business Name:</span>
                        <strong className="text-slate-900">{job.customerName || 'Mahima Commercial Enterprises Pty Ltd'}</strong>
                      </div>
                      <div>
                        <span className="text-slate-500 font-semibold block text-[11px]">Onsite Contact Person:</span>
                        <a href={`tel:${job.onsitePhone || '0412345678'}`} className="text-[#0286cd] font-bold hover:underline flex items-center gap-1">
                          <Phone className="w-3.5 h-3.5" /> {job.onsiteContact || 'Mahima Sharma'} ({job.onsitePhone || '0412 345 678'})
                        </a>
                      </div>
                    </div>

                    {job.description && (
                      <div className="bg-white p-3 rounded-xl border border-slate-200 space-y-1">
                        <span className="text-[11px] font-bold text-slate-600 uppercase tracking-wider">Description of What Happened:</span>
                        <p className="text-slate-800 leading-relaxed font-normal">"{job.description}"</p>
                      </div>
                    )}

                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-[11px]">
                      <div className="bg-white p-2.5 rounded-xl border border-slate-200 text-center">
                        <span className="text-slate-500 block text-[10px]">Affected Area</span>
                        <strong className="text-slate-900">{job.affectedArea || 25} m²</strong>
                      </div>
                      <div className="bg-white p-2.5 rounded-xl border border-slate-200 text-center">
                        <span className="text-slate-500 block text-[10px]">Still Ongoing?</span>
                        <strong className={job.isOngoing ? 'text-red-600 font-bold' : 'text-emerald-700 font-bold'}>
                          {job.isOngoing ? 'Yes (Active Leak)' : 'No (Stopped)'}
                        </strong>
                      </div>
                      <div className="bg-white p-2.5 rounded-xl border border-slate-200 text-center">
                        <span className="text-slate-500 block text-[10px]">Safe to Access?</span>
                        <strong className={job.isSafeToAccess !== false ? 'text-emerald-700 font-bold' : 'text-amber-700 font-bold'}>
                          {job.isSafeToAccess !== false ? 'Yes (Safe)' : 'No (Hazards)'}
                        </strong>
                      </div>
                      <div className="bg-white p-2.5 rounded-xl border border-slate-200 text-center">
                        <span className="text-slate-500 block text-[10px]">SLA Target Attendance</span>
                        <strong className="text-[#0286cd]">Within 2–4 Hours</strong>
                      </div>
                    </div>

                    {/* Site Access & Security Notes */}
                    <div className="bg-blue-50/80 p-3 rounded-xl border border-blue-200 space-y-2 text-blue-950">
                      <div className="font-bold text-xs">🔑 Access & Security Instructions:</div>
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-[11px]">
                        <div><strong>Access:</strong> {job.accessInstructions || 'Standard keycard/reception access.'}</div>
                        <div><strong>Restrictions:</strong> {job.accessRestrictions || 'None reported.'}</div>
                        <div><strong>Parking:</strong> {job.parkingInstructions || 'Use visitor bay / loading dock.'}</div>
                      </div>
                    </div>

                    {/* Photos & Videos */}
                    {(photos.length > 0 || videos.length > 0) && (
                      <div className="space-y-2 pt-2 border-t border-slate-200">
                        {photos.length > 0 && (
                          <div>
                            <span className="font-bold text-slate-700 block mb-1">Incident Photos ({photos.length})</span>
                            <div className="flex gap-2 overflow-x-auto pb-1">
                              {photos.map((src, i) => (
                                <a key={i} href={src} target="_blank" rel="noreferrer">
                                  <img src={src} alt="Incident Photo" className="w-20 h-20 object-cover rounded-xl border border-slate-300 hover:opacity-90 shadow-sm" />
                                </a>
                              ))}
                            </div>
                          </div>
                        )}
                        {videos.length > 0 && (
                          <div>
                            <span className="font-bold text-slate-700 block mb-1">Incident Videos ({videos.length})</span>
                            <div className="flex gap-2 overflow-x-auto pb-1">
                              {videos.map((src, i) => (
                                <video key={i} src={src} controls className="w-40 h-24 rounded-xl border border-slate-300 bg-black object-cover" />
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                  </div>

                  {/* Accept Dispatch Action */}
                  <button
                    onClick={() => handleStatusUpdate(job.id, 'ACCEPTED')}
                    className="w-full bg-emerald-600 hover:bg-emerald-500 text-white font-extrabold py-4 rounded-2xl text-xs sm:text-sm shadow-xl transition-all cursor-pointer flex items-center justify-center gap-2"
                  >
                    <CheckCircle2 className="w-5 h-5 text-white" />
                    ACCEPT EMERGENCY TASK DISPATCH
                  </button>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="bg-white p-8 rounded-3xl text-center text-slate-500 text-xs border border-slate-200 shadow-sm space-y-2">
            <p className="font-semibold">No new emergency dispatches awaiting technician acceptance.</p>
            <p className="text-[11px] text-slate-400">New emergency dispatches assigned by Admin will appear here immediately.</p>
          </div>
        )
      )}

      {/* RENDER ONGOING REQUESTS (ACCEPTED BY TECHNICIAN & IN-PROGRESS) */}
      {techTab === 'ongoing' && (
        ongoingJobs.length > 0 ? (
          <div className="max-h-[580px] overflow-y-auto pr-1.5 space-y-6 custom-scroll-container">
            {ongoingJobs.map(job => {
              const photos = Array.isArray(job.photos) ? job.photos : JSON.parse(job.photosJson || '[]');
              const videos = Array.isArray(job.videos) ? job.videos : JSON.parse(job.videosJson || '[]');

              return (
                <div key={job.id} className="bg-white p-6 rounded-3xl border border-slate-200 shadow-xl space-y-5">
                  {/* Job Header */}
                  <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 pb-4">
                    <div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-xs font-mono font-black text-[#0286cd] bg-blue-50 px-3 py-1 rounded-lg border border-blue-200">
                          {job.jobNumber || job.id}
                        </span>
                        <span className={`text-xs px-3 py-1.5 rounded-lg font-black tracking-wide inline-flex items-center gap-1.5 shadow-sm ${
                          job.status === 'ACCEPTED' ? 'bg-emerald-100 text-emerald-900 border border-emerald-300' :
                          job.status === 'TRAVELLING' ? 'bg-indigo-100 text-indigo-900 border border-indigo-300 animate-pulse' :
                          job.status === 'ARRIVED' ? 'bg-purple-100 text-purple-900 border border-purple-300' :
                          'bg-amber-100 text-amber-900 border border-amber-300 animate-pulse'
                        }`}>
                          {job.status === 'ACCEPTED' ? '✅ ACCEPTED BY YOU' :
                           job.status === 'TRAVELLING' ? '🚗 TRAVELLING TO SITE' :
                           job.status === 'ARRIVED' ? '📍 ARRIVED ON SITE' :
                           '🧹 IN PROGRESS (Cleaning)'}
                        </span>
                      </div>
                      <h3 className="text-lg font-extrabold text-slate-900 mt-2">{job.category} Emergency</h3>
                      <p className="text-xs text-slate-600 font-medium">📍 {job.locationName || 'Service Site'} • {job.address}</p>
                    </div>

                    <a 
                      href={`https://maps.google.com/?q=${encodeURIComponent(job.address)}`} 
                      target="_blank" 
                      rel="noreferrer"
                      className="bg-[#0286cd] hover:bg-[#026fa8] text-white font-bold px-3.5 py-2 rounded-xl text-xs flex items-center gap-1.5 shadow transition-all"
                    >
                      <MapPin className="w-4 h-4" /> Open Maps Navigation
                    </a>
                  </div>

                  {/* COMPLETE REFERENCE DETAILS */}
                  <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200 space-y-3.5 text-xs text-slate-800">
                    <h4 className="font-black text-slate-900 text-xs uppercase tracking-wider text-[#0286cd] flex items-center gap-1.5">
                      <FileText className="w-4 h-4" /> Complete Incident Reference & Site Info
                    </h4>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3 bg-white p-3 rounded-xl border border-slate-200 font-medium">
                      <div>
                        <span className="text-slate-500 font-semibold block text-[11px]">Customer Business Name:</span>
                        <strong className="text-slate-900">{job.customerName || 'Mahima Commercial Enterprises Pty Ltd'}</strong>
                      </div>
                      <div>
                        <span className="text-slate-500 font-semibold block text-[11px]">Onsite Contact Person:</span>
                        <a href={`tel:${job.onsitePhone || '0412345678'}`} className="text-[#0286cd] font-bold hover:underline flex items-center gap-1">
                          <Phone className="w-3.5 h-3.5" /> {job.onsiteContact || 'Mahima Sharma'} ({job.onsitePhone || '0412 345 678'})
                        </a>
                      </div>
                    </div>

                    {job.description && (
                      <div className="bg-white p-3 rounded-xl border border-slate-200 space-y-1">
                        <span className="text-[11px] font-bold text-slate-600 uppercase tracking-wider">Description of What Happened:</span>
                        <p className="text-slate-800 leading-relaxed font-normal">"{job.description}"</p>
                      </div>
                    )}

                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-[11px]">
                      <div className="bg-white p-2.5 rounded-xl border border-slate-200 text-center">
                        <span className="text-slate-500 block text-[10px]">Affected Area</span>
                        <strong className="text-slate-900">{job.affectedArea || 25} m²</strong>
                      </div>
                      <div className="bg-white p-2.5 rounded-xl border border-slate-200 text-center">
                        <span className="text-slate-500 block text-[10px]">Still Ongoing?</span>
                        <strong className={job.isOngoing ? 'text-red-600 font-bold' : 'text-emerald-700 font-bold'}>
                          {job.isOngoing ? 'Yes (Active Leak)' : 'No (Stopped)'}
                        </strong>
                      </div>
                      <div className="bg-white p-2.5 rounded-xl border border-slate-200 text-center">
                        <span className="text-slate-500 block text-[10px]">Safe to Access?</span>
                        <strong className={job.isSafeToAccess !== false ? 'text-emerald-700 font-bold' : 'text-amber-700 font-bold'}>
                          {job.isSafeToAccess !== false ? 'Yes (Safe)' : 'No (Hazards)'}
                        </strong>
                      </div>
                      <div className="bg-white p-2.5 rounded-xl border border-slate-200 text-center">
                        <span className="text-slate-500 block text-[10px]">SLA Target Attendance</span>
                        <strong className="text-[#0286cd]">Within 2–4 Hours</strong>
                      </div>
                    </div>

                    {/* Site Access & Security Notes */}
                    <div className="bg-blue-50/80 p-3 rounded-xl border border-blue-200 space-y-2 text-blue-950">
                      <div className="font-bold text-xs">🔑 Access & Security Instructions:</div>
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-[11px]">
                        <div><strong>Access:</strong> {job.accessInstructions || 'Standard keycard/reception access.'}</div>
                        <div><strong>Restrictions:</strong> {job.accessRestrictions || 'None reported.'}</div>
                        <div><strong>Parking:</strong> {job.parkingInstructions || 'Use visitor bay / loading dock.'}</div>
                      </div>
                    </div>

                    {/* Photos & Videos */}
                    {(photos.length > 0 || videos.length > 0) && (
                      <div className="space-y-2 pt-2 border-t border-slate-200">
                        {photos.length > 0 && (
                          <div>
                            <span className="font-bold text-slate-700 block mb-1">Incident Photos ({photos.length})</span>
                            <div className="flex gap-2 overflow-x-auto pb-1">
                              {photos.map((src, i) => (
                                <a key={i} href={src} target="_blank" rel="noreferrer">
                                  <img src={src} alt="Incident Photo" className="w-20 h-20 object-cover rounded-xl border border-slate-300 hover:opacity-90 shadow-sm" />
                                </a>
                              ))}
                            </div>
                          </div>
                        )}
                        {videos.length > 0 && (
                          <div>
                            <span className="font-bold text-slate-700 block mb-1">Incident Videos ({videos.length})</span>
                            <div className="flex gap-2 overflow-x-auto pb-1">
                              {videos.map((src, i) => (
                                <video key={i} src={src} controls className="w-40 h-24 rounded-xl border border-slate-300 bg-black object-cover" />
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                  </div>

                  {/* LIVE GPS SHARING BANNER (When Travelling or Onsite) */}
                  {['TRAVELLING', 'ARRIVED'].includes(job.status) && (
                    <div className="bg-gradient-to-r from-blue-900 to-indigo-900 p-4 rounded-2xl text-white space-y-2 shadow-lg border border-blue-700">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <span className="relative flex h-3 w-3">
                            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                            <span className="relative inline-flex rounded-full h-3 w-3 bg-emerald-500"></span>
                          </span>
                          <span className="text-xs font-black text-emerald-400 uppercase tracking-wider">
                            Live GPS Location Transmitting
                          </span>
                        </div>
                        <span className="text-[11px] font-extrabold text-blue-200 bg-blue-950 px-2.5 py-1 rounded-lg border border-blue-700">
                          Live ETA: {job.status === 'TRAVELLING' ? '14 mins in transit' : 'On Site Now'}
                        </span>
                      </div>
                      <p className="text-[11px] text-blue-200">
                        📍 Shared location: En route on Grenfell St & King William St towards {job.locationName}
                      </p>
                    </div>
                  )}

                  {/* STEP-BY-STEP CONTROL WORKFLOW */}
                  <div className="space-y-3 pt-2">
                    <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider">Technician Status Control Workflow</h4>

                    {/* Step 2: Start Driving - Travelling to Site */}
                    {job.status === 'ACCEPTED' && (
                      <button
                        onClick={() => handleStatusUpdate(job.id, 'TRAVELLING')}
                        className="w-full bg-[#0f3cad] hover:bg-[#0c2f87] text-white font-extrabold py-3.5 rounded-2xl text-xs shadow-lg transition-all cursor-pointer flex items-center justify-center gap-2"
                      >
                        <Wrench className="w-5 h-5 text-white" />
                        🚗 START DRIVING - TRAVELLING TO SITE (Share Live GPS & ETA)
                      </button>
                    )}

                    {/* Step 3: Arrived On Site */}
                    {job.status === 'TRAVELLING' && (
                      <button
                        onClick={() => handleStatusUpdate(job.id, 'ARRIVED')}
                        className="w-full bg-purple-700 hover:bg-purple-800 text-white font-extrabold py-3.5 rounded-2xl text-xs shadow-lg transition-all cursor-pointer flex items-center justify-center gap-2"
                      >
                        <MapPin className="w-5 h-5 text-white" />
                        📍 ARRIVED ON SITE
                      </button>
                    )}

                    {/* Step 4: Start Cleaning */}
                    {job.status === 'ARRIVED' && (
                      <button
                        onClick={() => handleStatusUpdate(job.id, 'IN_PROGRESS')}
                        className="w-full bg-emerald-600 hover:bg-emerald-500 text-white font-extrabold py-3.5 rounded-2xl text-xs shadow-lg transition-all cursor-pointer flex items-center justify-center gap-2"
                      >
                        <Play className="w-5 h-5 text-white" />
                        🧹 START CLEANING JOB (Start 1-Hr Included Labour Timer)
                      </button>
                    )}

                    {/* Step 5: Complete Cleaning Job & Issue Report */}
                    {job.status === 'IN_PROGRESS' && (
                      <button
                        onClick={() => handleStatusUpdate(job.id, 'COMPLETED')}
                        className="w-full bg-[#0286cd] hover:bg-[#026fa8] text-white font-black py-4 rounded-2xl text-xs sm:text-sm shadow-xl transition-all cursor-pointer flex items-center justify-center gap-2 border border-blue-400"
                      >
                        <CheckCircle2 className="w-5 h-5 text-white" />
                        🏁 COMPLETE CLEANING JOB & ISSUE PDF COMPLETION REPORT
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="bg-white p-8 rounded-3xl text-center text-slate-500 text-xs border border-slate-200 shadow-sm space-y-2">
            <p className="font-semibold">No active ongoing emergency jobs accepted by technician.</p>
            <p className="text-[11px] text-slate-400">Accept an assigned request to begin live dispatch & transit tracking.</p>
          </div>
        )
      )}

      {/* RENDER COMPLETED RECORDS IN A ZERO-HORIZONTAL-SCROLL LIST */}
      {techTab === 'completed' && (
        completedJobs.length > 0 ? (
          <div className="bg-white rounded-3xl border border-slate-200 shadow-md overflow-hidden text-xs divide-y divide-slate-100">
            <div className="p-4 bg-slate-900 text-white font-extrabold flex items-center justify-between">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                <span>Completed Emergency Service Records ({completedJobs.length})</span>
              </div>
              <span className="text-[10px] font-mono bg-blue-900 text-blue-200 px-2.5 py-0.5 rounded border border-blue-700">
                Sign-off Log
              </span>
            </div>

            <div className="divide-y divide-slate-100">
              {completedJobs.map(job => (
                <div key={job.id} className="p-4 hover:bg-slate-50 transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div className="space-y-1 min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-mono font-bold text-[#0286cd] text-xs bg-blue-50 px-2.5 py-0.5 rounded border border-blue-200">
                        {job.jobNumber || job.id}
                      </span>
                      <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase bg-emerald-100 text-emerald-900 border border-emerald-300">
                        ✓ COMPLETED
                      </span>
                      <span className="text-slate-500 text-[11px] font-semibold">
                        {job.category} Emergency
                      </span>
                    </div>
                    <div className="font-extrabold text-slate-900 text-sm mt-1">{job.customerName}</div>
                    <div className="text-[11px] text-slate-500 font-normal truncate">📍 {job.locationName || 'Service Site'} • {job.address}</div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0 pt-2 sm:pt-0 border-t sm:border-t-0 border-slate-100 justify-end">
                    <button
                      onClick={() => openPrintableReport(job.id)}
                      className="h-8 bg-[#0286cd] hover:bg-[#026fa8] text-white font-extrabold px-3.5 rounded-xl text-xs inline-flex items-center gap-1.5 transition-all shadow-sm cursor-pointer"
                    >
                      <FileText className="w-3.5 h-3.5" /> View
                    </button>
                    <button
                      onClick={() => handleDownloadPdfReport(job.id, job.jobNumber)}
                      className="h-8 bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold px-3.5 rounded-xl text-xs inline-flex items-center gap-1.5 transition-all shadow-sm cursor-pointer"
                    >
                      <Download className="w-3.5 h-3.5" /> Download
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ) : (
          <div className="bg-white p-8 rounded-3xl text-center text-slate-500 text-xs border border-slate-200 shadow-sm">
            No completed emergency records found for this technician.
          </div>
        )
      )}

      {/* Technician Profile Modal */}
      {showProfileModal && (
        <TechnicianProfileModal
          currentUser={currentUser}
          onUpdateUser={(updated) => {
            if (setCurrentUser) setCurrentUser(updated);
          }}
          onClose={() => setShowProfileModal(false)}
          handleLogout={handleLogout}
        />
      )}
    </div>
  );
}

/* =========================================================================
   COMPREHENSIVE ADMIN OPERATIONS & ACCOUNTS HUB COMPONENT
   ========================================================================= */
function AdminOperationsHub({ jobs, setJobs, config, customers, setCustomers, setSelectedCustomerId, setActiveTab, technicians, setTechnicians, setShowHotlineModal, openCompanyRegistrationModal, adminSubTab: parentSubTab, setAdminSubTab: parentSetSubTab }) {
  const [internalSubTab, setInternalSubTab] = useState('dispatch');
  const adminSubTab = parentSubTab || internalSubTab;
  const setAdminSubTab = parentSetSubTab || setInternalSubTab;
  const [showAddCustomerModal, setShowAddCustomerModal] = useState(false);
  const [showAddTechModal, setShowAddTechModal] = useState(false);
  const [editingTech, setEditingTech] = useState(null);
  const [selectedJobForDispatch, setSelectedJobForDispatch] = useState(null);
  const [selectedJobForDetails, setSelectedJobForDetails] = useState(null);
  const [selectedJobForLiveMap, setSelectedJobForLiveMap] = useState(null);
  const [dispatchFilter, setDispatchFilter] = useState('ALL'); // 'ALL', 'NEW', 'ACCEPTED', 'COMPLETED'

  const handleInspectCustomer = (custId) => {
    setSelectedCustomerId(custId);
    setActiveTab('customer');
  };

  const handleAssignTechnician = async (jobId, techName, newStatus) => {
    try {
      const res = await fetch(`${API_BASE}/jobs/${jobId}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ technicianName: techName, status: newStatus || 'TECH_ASSIGNED' })
      });
      const updated = await res.json();
      if (!res.ok) {
        alert(updated.error || 'The technician could not be assigned.');
        return;
      }
      setJobs(prev => prev.map(j => j.id === jobId ? updated : j));
      // The server also updated the technician's status, so reload the roster
      const techRes = await fetch(`${API_BASE}/technicians`);
      if (techRes.ok) setTechnicians(await techRes.json());
    } catch (e) {
      alert('Network error: Unable to reach the server. The technician was not assigned.');
      return;
    }
    setSelectedJobForDispatch(null);
  };

  return (
    <div className="space-y-6">
      {/* Admin Operations Top Bar */}
      <div className="flex flex-wrap items-center justify-between gap-4 bg-white p-6 rounded-2xl border border-slate-200 shadow-md">
        <div>
          <h2 className="text-xl font-bold text-slate-900 flex items-center gap-2">
            <ShieldAlert className="w-6 h-6 text-[#0286cd]" />
            Admin Operations & Business Management Desk
          </h2>
          <p className="text-xs text-slate-600">Manage Customers, Multi-site Accounts, Call-out Allowances, Technician Dispatch & Reward Points</p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={() => openCompanyRegistrationModal()}
            className="bg-emerald-600 hover:bg-emerald-500 text-white font-bold py-2.5 px-4 rounded-xl text-xs flex items-center gap-2 shadow-md transition-all cursor-pointer"
          >
            <Building className="w-4 h-4 text-white" />
            REGISTER COMPANY (SYSTEM ADMIN)
          </button>

          <button
            onClick={() => setShowHotlineModal(true)}
            className="bg-red-600 hover:bg-red-500 text-white font-bold py-2.5 px-4 rounded-xl text-xs flex items-center gap-2 shadow-md transition-all cursor-pointer"
          >
            <Phone className="w-4 h-4" />
            CREATE HOTLINE PHONE REQUEST
          </button>
        </div>
      </div>

      {/* Admin Sub-Navigation Tabs */}
      <div className="flex flex-wrap gap-2 bg-slate-100 p-2 rounded-2xl border border-slate-200 text-xs font-medium">
        <button
          onClick={() => setAdminSubTab('dispatch')}
          className={`px-4 py-2.5 rounded-xl transition-all flex items-center gap-2 cursor-pointer ${
            adminSubTab === 'dispatch' ? 'bg-[#0286cd] text-white font-bold shadow-md' : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          <ShieldAlert className="w-4 h-4" />
          Incident Dispatch & SLA ({jobs.length})
        </button>

        <button
          onClick={() => setAdminSubTab('customers')}
          className={`px-4 py-2.5 rounded-xl transition-all flex items-center gap-2 cursor-pointer ${
            adminSubTab === 'customers' ? 'bg-[#0286cd] text-white font-bold shadow-md' : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          <Users className="w-4 h-4" />
          Customer Accounts Directory ({customers.length})
        </button>

        <button
          onClick={() => setAdminSubTab('technicians')}
          className={`px-4 py-2.5 rounded-xl transition-all flex items-center gap-2 cursor-pointer ${
            adminSubTab === 'technicians' ? 'bg-[#0286cd] text-white font-bold shadow-md' : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          <Wrench className="w-4 h-4" />
          Technician Fleet ({technicians.length})
        </button>

        <button
          onClick={() => setAdminSubTab('points')}
          className={`px-4 py-2.5 rounded-xl transition-all flex items-center gap-2 cursor-pointer ${
            adminSubTab === 'points' ? 'bg-[#0f3cad] text-white font-bold shadow-md' : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          <Award className="w-4 h-4" />
          Reward Points Approvals
        </button>

        <button
          onClick={() => setAdminSubTab('reports')}
          className={`px-4 py-2.5 rounded-xl transition-all flex items-center gap-2 cursor-pointer ${
            adminSubTab === 'reports' ? 'bg-emerald-600 text-white font-bold shadow-md' : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          <BarChart3 className="w-4 h-4" />
          Reports & Analytics
        </button>
      </div>

      {/* SUB-TAB 1: INCIDENT DISPATCH QUEUE & SLA MONITOR */}
      {adminSubTab === 'dispatch' && (() => {
        const newJobsCount = jobs.filter(j => j.status === 'NEW' || j.status === 'SUBMITTED').length;
        const acceptedJobsCount = jobs.filter(j => ['ACCEPTED', 'TECH_ASSIGNED', 'TRAVELLING', 'ARRIVED', 'IN_PROGRESS'].includes(j.status) || (j.technicianName && j.technicianName !== 'Unassigned' && !['COMPLETED', 'REPORT_ISSUED', 'CLOSED'].includes(j.status))).length;
        const completedJobsCount = jobs.filter(j => ['COMPLETED', 'REPORT_ISSUED', 'CLOSED'].includes(j.status)).length;

        const filteredJobs = jobs.filter(j => {
          if (dispatchFilter === 'NEW') return j.status === 'NEW' || j.status === 'SUBMITTED';
          if (dispatchFilter === 'ACCEPTED') return ['ACCEPTED', 'TECH_ASSIGNED', 'TRAVELLING', 'ARRIVED', 'IN_PROGRESS'].includes(j.status) || (j.technicianName && j.technicianName !== 'Unassigned' && !['COMPLETED', 'REPORT_ISSUED', 'CLOSED'].includes(j.status));
          if (dispatchFilter === 'COMPLETED') return ['COMPLETED', 'REPORT_ISSUED', 'CLOSED'].includes(j.status);
          return true;
        });

        return (
          <div className="bg-white p-6 rounded-2xl space-y-4 border border-slate-200 shadow-md">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 pb-4">
              <div>
                <h3 className="text-base font-extrabold text-slate-900 flex items-center gap-2">
                  <ShieldAlert className="w-5 h-5 text-[#0286cd]" />
                  Live Emergency Dispatch Desk
                </h3>
                <p className="text-xs text-slate-600">Filter by status state and inspect complete emergency request details</p>
              </div>

              {/* 3 Status Buttons: New Requests, Accepted Requests, Completed Requests */}
              <div className="flex flex-wrap items-center gap-2 bg-slate-100 p-1.5 rounded-2xl border border-slate-200">
                <button
                  onClick={() => setDispatchFilter('ALL')}
                  className={`px-3 py-1.5 rounded-xl text-xs font-black transition-all cursor-pointer ${
                    dispatchFilter === 'ALL'
                      ? 'bg-slate-900 text-white shadow-sm'
                      : 'text-slate-700 hover:text-slate-900 font-bold'
                  }`}
                >
                  📋 All ({jobs.length})
                </button>

                <button
                  onClick={() => setDispatchFilter('NEW')}
                  className={`px-3 py-1.5 rounded-xl text-xs font-black flex items-center gap-1 transition-all cursor-pointer ${
                    dispatchFilter === 'NEW'
                      ? 'bg-[#0286cd] text-white shadow-sm'
                      : 'text-slate-700 hover:text-[#0286cd] font-bold'
                  }`}
                >
                  <Zap className="w-3.5 h-3.5 text-blue-400" />
                  <span>New Requests ({newJobsCount})</span>
                </button>

                <button
                  onClick={() => setDispatchFilter('ACCEPTED')}
                  className={`px-3 py-1.5 rounded-xl text-xs font-black flex items-center gap-1 transition-all cursor-pointer ${
                    dispatchFilter === 'ACCEPTED'
                      ? 'bg-emerald-600 text-white shadow-sm'
                      : 'text-slate-700 hover:text-emerald-700 font-bold'
                  }`}
                >
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-300" />
                  <span>Accepted Requests ({acceptedJobsCount})</span>
                </button>

                <button
                  onClick={() => setDispatchFilter('COMPLETED')}
                  className={`px-3 py-1.5 rounded-xl text-xs font-black flex items-center gap-1 transition-all cursor-pointer ${
                    dispatchFilter === 'COMPLETED'
                      ? 'bg-purple-600 text-white shadow-sm'
                      : 'text-slate-700 hover:text-purple-700 font-bold'
                  }`}
                >
                  <FileText className="w-3.5 h-3.5 text-purple-300" />
                  <span>Completed Requests ({completedJobsCount})</span>
                </button>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="border-b border-slate-200 text-slate-500 font-bold">
                    <th className="py-3 px-4">Job Number</th>
                    <th className="py-3 px-4">Customer Business</th>
                    <th className="py-3 px-4">Location</th>
                    <th className="py-3 px-4">Incident Category</th>
                    <th className="py-3 px-4">Status</th>
                    <th className="py-3 px-4">Assigned Tech</th>
                    <th className="py-3 px-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredJobs.map(job => (
                    <tr key={job.id} className="hover:bg-slate-50 transition-all">
                      <td className="py-3.5 px-4 align-middle font-mono font-bold text-[#0286cd] whitespace-nowrap">{job.jobNumber || job.id}</td>
                      <td className="py-3.5 px-4 align-middle font-semibold text-slate-900">{job.customerName}</td>
                      <td className="py-3.5 px-4 align-middle text-slate-600">{job.locationName}</td>
                      <td className="py-3.5 px-4 align-middle text-slate-600 whitespace-nowrap">{job.category}</td>
                      <td className="py-3.5 px-4 align-middle whitespace-nowrap">
                        {(() => {
                          const s = (job.status || 'NEW').toUpperCase();
                          if (s === 'NEW' || s === 'SUBMITTED') {
                            return (
                              <span className="px-2.5 py-1.5 rounded-full text-[11px] font-black border uppercase tracking-wider inline-flex items-center gap-1.5 bg-[#0286cd] text-white border-blue-600 shadow-md animate-pulse">
                                ✨ NEW
                              </span>
                            );
                          }
                          if (s === 'TECH_ASSIGNED') {
                            return (
                              <span className="px-2.5 py-1.5 rounded-full text-[11px] font-black border uppercase tracking-wider inline-flex items-center gap-1.5 bg-blue-100 text-blue-900 border-blue-300 shadow-sm">
                                👤 TECH ASSIGNED
                              </span>
                            );
                          }
                          if (s === 'ACCEPTED') {
                            return (
                              <span className="px-2.5 py-1.5 rounded-full text-[11px] font-black border uppercase tracking-wider inline-flex items-center gap-1.5 bg-emerald-100 text-emerald-900 border-emerald-300 shadow-sm">
                                ✅ TECHNICIAN ACCEPTED
                              </span>
                            );
                          }
                          if (s === 'TRAVELLING') {
                            return (
                              <button
                                onClick={() => setSelectedJobForLiveMap(job)}
                                title="Click to view live technician GPS location on map"
                                className="px-2.5 py-1.5 rounded-full text-[11px] font-black border uppercase tracking-wider inline-flex items-center gap-1.5 bg-indigo-600 hover:bg-indigo-700 text-white border-indigo-700 shadow-md animate-pulse cursor-pointer transition-all"
                              >
                                <MapPin className="w-3.5 h-3.5 text-white" />
                                <span>🚗 TRAVELLING</span>
                              </button>
                            );
                          }
                          if (s === 'ARRIVED') {
                            return (
                              <span className="px-2.5 py-1.5 rounded-full text-[11px] font-black border uppercase tracking-wider inline-flex items-center gap-1.5 bg-purple-100 text-purple-900 border-purple-300 shadow-sm">
                                📍 ARRIVED ON SITE
                              </span>
                            );
                          }
                          if (s === 'IN_PROGRESS') {
                            return (
                              <span className="px-2.5 py-1.5 rounded-full text-[11px] font-black border uppercase tracking-wider inline-flex items-center gap-1.5 bg-amber-100 text-amber-900 border-amber-300 shadow-sm animate-pulse">
                                🧹 IN PROGRESS
                              </span>
                            );
                          }
                          if (s === 'COMPLETED' || s === 'REPORT_ISSUED' || s === 'CLOSED') {
                            return (
                              <span className="px-2.5 py-1.5 rounded-full text-[11px] font-black border uppercase tracking-wider inline-flex items-center gap-1.5 bg-emerald-700 text-white border-emerald-800 shadow-sm">
                                🎉 COMPLETED
                              </span>
                            );
                          }
                          return (
                            <span className="px-2.5 py-1.5 rounded-full text-[11px] font-black border uppercase tracking-wider inline-flex items-center gap-1.5 bg-slate-100 text-slate-800 border-slate-300">
                              {s.replace(/_/g, ' ')}
                            </span>
                          );
                        })()}
                      </td>
                      <td className="py-3.5 px-4 align-middle font-semibold text-slate-900 whitespace-nowrap">
                        {job.technicianName && job.technicianName !== 'Unassigned' ? (
                          <div className="flex items-center gap-1.5">
                            <span className="w-2 h-2 rounded-full bg-emerald-500 shrink-0"></span>
                            <span className="truncate">{job.technicianName}</span>
                          </div>
                        ) : (
                          <span className="text-slate-400 italic font-normal">Unassigned</span>
                        )}
                      </td>
                      <td className="py-3.5 px-4 align-middle text-right whitespace-nowrap">
                        <div className="inline-flex items-center justify-end gap-2">
                          {['TRAVELLING', 'ARRIVED', 'IN_PROGRESS'].includes(job.status) && (
                            <button
                              onClick={() => setSelectedJobForLiveMap(job)}
                              className="h-8 bg-indigo-600 hover:bg-indigo-700 text-white px-3 rounded-xl font-extrabold text-xs transition-all cursor-pointer shadow-sm border border-indigo-700 inline-flex items-center gap-1 animate-pulse"
                            >
                              <MapPin className="w-3.5 h-3.5 text-white" />
                              <span>Live GPS Map</span>
                            </button>
                          )}

                          <button 
                            onClick={() => setSelectedJobForDetails(job)}
                            className="h-8 bg-slate-100 hover:bg-slate-200 text-slate-800 px-3 rounded-xl font-bold text-xs transition-all cursor-pointer shadow-sm border border-slate-300 inline-flex items-center gap-1"
                          >
                            <FileText className="w-3.5 h-3.5 text-[#0286cd]" />
                            <span>View Details</span>
                          </button>

                          <button 
                            onClick={() => setSelectedJobForDispatch(job)}
                            className="h-8 bg-[#0286cd] hover:bg-[#026fa8] text-white px-3.5 rounded-xl font-extrabold text-xs transition-all cursor-pointer shadow-sm border border-blue-600 inline-flex items-center gap-1"
                          >
                            <span>Dispatch / Assign</span>
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                  {filteredJobs.length === 0 && (
                    <tr>
                      <td colSpan={7} className="py-8 text-center text-slate-500 font-medium">
                        No emergency requests found matching the "{dispatchFilter}" status filter.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        );
      })()}

      {/* SUB-TAB 2: CUSTOMER ACCOUNTS DIRECTORY */}
      {adminSubTab === 'customers' && (
        <div className="bg-white p-6 rounded-2xl space-y-4 border border-slate-200 shadow-md">
          <div className="flex items-center justify-between border-b border-slate-200 pb-4">
            <div>
              <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wider">Registered Business Customer Accounts</h3>
              <p className="text-xs text-slate-600">View membership subscriptions, ABNs, call-out balances, credentials, and inspect account dashboards</p>
            </div>
            <button 
              onClick={() => openCompanyRegistrationModal()}
              className="bg-emerald-600 hover:bg-emerald-500 text-white font-bold px-4 py-2 rounded-xl text-xs flex items-center gap-1.5 shadow transition-all cursor-pointer"
            >
              <Plus className="w-4 h-4" /> Register Company & Issue Credentials
            </button>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-slate-200 text-slate-500 font-bold">
                  <th className="py-3 px-4">Business Name & ABN</th>
                  <th className="py-3 px-4">Primary Contact</th>
                  <th className="py-3 px-4">Membership Plan</th>
                  <th className="py-3 px-4">Payment Method</th>
                  <th className="py-3 px-4">Call-outs Used</th>
                  <th className="py-3 px-4">Points Balance</th>
                  <th className="py-3 px-4 text-right">Account Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {customers.map(cust => (
                  <tr key={cust.id} className="hover:bg-slate-50 transition-all">
                    <td className="py-4 px-4">
                      <div className="font-bold text-slate-900">{cust.businessName}</div>
                      <div className="text-[10px] text-slate-500 font-mono">ABN: {cust.abn} • {(cust.locations || []).length || 1} Site(s)</div>
                    </td>
                    <td className="py-4 px-4">
                      <div className="text-slate-800 font-medium">{cust.primaryContactName || cust.primaryContact}</div>
                      <div className="text-[10px] text-slate-500">{cust.phoneNumber || cust.phone}</div>
                    </td>
                    <td className="py-4 px-4 font-semibold text-[#0286cd] uppercase">{cust.membershipPlan} Plan</td>
                    <td className="py-4 px-4">
                      <span className="px-2 py-0.5 rounded bg-emerald-50 text-emerald-700 border border-emerald-200 font-mono text-[10px]">
                        {cust.paymentMethod}
                      </span>
                    </td>
                    <td className="py-4 px-4 font-extrabold text-slate-800">{cust.calloutsUsed} Used</td>
                    <td className="py-4 px-4 font-bold text-purple-700">{cust.pointsBalance} pts</td>
                    <td className="py-4 px-4 text-right space-x-2">
                      <button 
                        onClick={() => handleInspectCustomer(cust.id)}
                        className="bg-[#0286cd] hover:bg-[#026fa8] text-white font-bold px-3 py-1.5 rounded-lg flex items-center gap-1 inline-flex cursor-pointer shadow-sm"
                      >
                        <User className="w-3.5 h-3.5" /> Inspect Portal
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* SUB-TAB 3: TECHNICIAN FLEET MANAGEMENT */}
      {adminSubTab === 'technicians' && (
        <div className="bg-white p-6 rounded-2xl space-y-4 border border-slate-200 shadow-md">
          <div className="flex items-center justify-between border-b border-slate-200 pb-4">
            <div>
              <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wider">Field Technician Roster & Status</h3>
              <p className="text-xs text-slate-600">Monitor real-time technician availability, active dispatch jobs, and fleet ratings</p>
            </div>
            <button 
              onClick={() => setShowAddTechModal(true)}
              className="bg-[#0286cd] hover:bg-[#026fa8] text-white font-bold px-4 py-2 rounded-xl text-xs flex items-center gap-1.5 shadow transition-all cursor-pointer"
            >
              <Plus className="w-4 h-4" /> Add New Technician
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {technicians.map(tech => (
              <div key={tech.id} className="p-4 bg-slate-50 rounded-xl border border-slate-200 space-y-3 shadow-sm flex flex-col justify-between">
                <div className="flex items-center gap-3">
                  <img
                    src={tech.avatar || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=150&q=80'}
                    alt={tech.name}
                    className="w-12 h-12 rounded-2xl object-cover border border-slate-300 shadow-sm shrink-0"
                  />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-1">
                      <div className="font-extrabold text-slate-900 text-sm truncate">{tech.name}</div>
                      <span className={`px-2 py-0.5 rounded text-[10px] font-bold shrink-0 ${
                        tech.status === 'AVAILABLE' ? 'bg-emerald-100 text-emerald-800 border border-emerald-200' :
                        'bg-amber-100 text-amber-800 border border-amber-200'
                      }`}>
                        {tech.status}
                      </span>
                    </div>
                    <div className="text-[11px] text-slate-600 font-medium">📞 {tech.phone}</div>
                    <div className="text-[11px] text-emerald-700 font-bold">⭐ {tech.rating || 5.0} / 5.0 Rating</div>
                  </div>
                </div>

                <div className="pt-2 border-t border-slate-200 flex justify-end">
                  <button
                    onClick={() => setEditingTech(tech)}
                    className="bg-slate-800 hover:bg-slate-900 text-white font-bold px-3 py-1.5 rounded-lg text-[11px] flex items-center gap-1 transition-all cursor-pointer shadow-sm border border-slate-700"
                  >
                    <Edit3 className="w-3.5 h-3.5 text-amber-400" /> Edit Technician
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* SUB-TAB 4: REWARD POINTS APPROVALS */}
      {adminSubTab === 'points' && (
        <div className="bg-white p-6 rounded-2xl space-y-4 border border-slate-200 shadow-md">
          <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wider text-[#0286cd]">Points Redemption Requests Approval Queue</h3>
          <p className="text-xs text-slate-600">Review periodical cleaning requests. Points are deducted from the customer's wallet only upon your approval.</p>
          <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 text-xs text-slate-500 text-center font-medium">
            No pending redemption requests requiring approval.
          </div>
        </div>
      )}

      {/* SUB-TAB 5: REPORTS & ANALYTICS */}
      {adminSubTab === 'reports' && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="bg-white p-5 rounded-2xl space-y-2 border border-slate-200 shadow-md">
            <div className="text-xs text-slate-500 uppercase font-extrabold">2-4 Hr SLA Compliance</div>
            <div className="text-3xl font-extrabold text-emerald-600">98.4%</div>
            <p className="text-[11px] text-slate-500">Average response time: 42 mins</p>
          </div>

          <div className="bg-white p-5 rounded-2xl space-y-2 border border-slate-200 shadow-md">
            <div className="text-xs text-slate-500 uppercase font-extrabold">Active Subscriptions</div>
            <div className="text-3xl font-extrabold text-[#0286cd]">{customers.length} Accounts</div>
            <p className="text-[11px] text-slate-500">$18,420 MRR via PayTo Direct</p>
          </div>

          <div className="bg-white p-5 rounded-2xl space-y-2 border border-slate-200 shadow-md">
            <div className="text-xs text-slate-500 uppercase font-extrabold">Total Emergency Call-outs</div>
            <div className="text-3xl font-extrabold text-purple-700">{jobs.length} Requests</div>
            <p className="text-[11px] text-slate-500">0 SLA breaches this month</p>
          </div>
        </div>
      )}

      {/* MODAL: ADD BUSINESS CUSTOMER */}
      {showAddCustomerModal && (
        <AddCustomerModal 
          onClose={() => setShowAddCustomerModal(false)}
          onAdd={async (newCustData) => {
            try {
              const res = await fetch(`${API_BASE}/customers`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(newCustData)
              });
              const saved = await res.json();
              if (res.ok && saved.id) {
                const { tempPassword, loginEmail, ...customer } = saved;
                setCustomers([...customers, customer]);
                setShowAddCustomerModal(false);
                if (tempPassword) {
                  alert(`Customer created.\n\nLogin email: ${loginEmail}\nTemporary password: ${tempPassword}\n\nGive these to the customer. The password is shown only once.`);
                }
              } else {
                alert(saved.error || 'Failed to add customer. Please check the details.');
              }
            } catch (e) {
              alert('Network error: Unable to reach server to create customer.');
            }
          }}
        />
      )}

      {/* MODAL: ADD NEW TECHNICIAN */}
      {showAddTechModal && (
        <AddTechnicianModal 
          onClose={() => setShowAddTechModal(false)}
          onAdd={async (newTechData) => {
            try {
              const res = await fetch(`${API_BASE}/technicians`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(newTechData)
              });
              const saved = await res.json();
              if (res.ok && saved.id) {
                const { tempPassword, ...tech } = saved;
                setTechnicians([...technicians, tech]);
                setShowAddTechModal(false);
                if (tempPassword) {
                  alert(`Technician created.\n\nLogin email: ${tech.email}\nTemporary password: ${tempPassword}\n\nGive these to the technician. The password is shown only once.`);
                }
              } else {
                alert(saved.error || 'Failed to add technician. Please check phone and details.');
              }
            } catch (e) {
              alert('Network error: Unable to reach server to register technician.');
            }
          }}
        />
      )}

      {/* MODAL: DISPATCH & ASSIGN TECHNICIAN */}
      {selectedJobForDispatch && (
        <AssignDispatchModal 
          job={selectedJobForDispatch}
          technicians={technicians}
          onClose={() => setSelectedJobForDispatch(null)}
          onAssign={(techName, status) => handleAssignTechnician(selectedJobForDispatch.id, techName, status)}
        />
      )}

      {/* MODAL: LIVE TECHNICIAN GPS LOCATION MAP */}
      {selectedJobForLiveMap && (
        <LiveTechnicianMapModal
          job={selectedJobForLiveMap}
          onClose={() => setSelectedJobForLiveMap(null)}
        />
      )}

      {/* MODAL: INSPECT EMERGENCY REQUEST DETAILS */}
      {selectedJobForDetails && (
        <AdminJobDetailsModal
          job={selectedJobForDetails}
          onClose={() => setSelectedJobForDetails(null)}
          onDispatchClick={(jobToDispatch) => setSelectedJobForDispatch(jobToDispatch)}
        />
      )}

      {/* MODAL: EDIT TECHNICIAN DETAILS */}
      {editingTech && (
        <EditTechnicianModal
          tech={editingTech}
          onClose={() => setEditingTech(null)}
          onSave={async (updatedTech) => {
            try {
              const res = await fetch(`${API_BASE}/technicians/${updatedTech.id}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(updatedTech)
              });
              const saved = await res.json();
              if (res.ok && saved.id) {
                setTechnicians(technicians.map(t => t.id === saved.id ? saved : t));
                setEditingTech(null);
              } else {
                alert(saved.error || 'Failed to update technician.');
              }
            } catch (e) {
              alert('Network error: Unable to reach server to save technician changes.');
            }
          }}
        />
      )}
    </div>
  );
}

/* =========================================================================
   MODAL: EDIT TECHNICIAN DETAILS
   ========================================================================= */
function EditTechnicianModal({ tech, onClose, onSave }) {
  const [name, setName] = useState(tech?.name || '');
  const [phone, setPhone] = useState(tech?.phone || '');
  const [status, setStatus] = useState(tech?.status || 'AVAILABLE');
  const [avatar, setAvatar] = useState(tech?.avatar || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=150&q=80');
  const [rating, setRating] = useState(tech?.rating || 5.0);

  const handlePhotoUpload = (e) => {
    const file = e.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setAvatar(reader.result);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    onSave({
      ...tech,
      name,
      phone,
      status,
      avatar,
      rating: parseFloat(rating)
    });
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-white max-w-md w-full p-6 rounded-3xl space-y-4 border border-slate-200 shadow-2xl text-xs text-slate-800">
        <div className="flex items-center justify-between border-b border-slate-200 pb-3">
          <h3 className="text-lg font-bold text-slate-900 flex items-center gap-2">
            <Edit3 className="w-5 h-5 text-[#0286cd]" />
            Edit Technician Details
          </h3>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-700 cursor-pointer"><X className="w-5 h-5" /></button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Profile Photo Uploader & Live Preview */}
          <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200 space-y-3">
            <label className="block text-slate-800 font-bold text-xs">Technician Profile Photo</label>

            <div className="flex items-center gap-4">
              <img
                src={avatar}
                alt="Profile Preview"
                className="w-16 h-16 rounded-2xl object-cover border border-slate-300 shadow-md shrink-0"
              />

              <div className="space-y-2 flex-1">
                <label className="bg-[#0286cd] hover:bg-[#026fa8] text-white font-bold px-3 py-2 rounded-xl text-xs cursor-pointer inline-flex items-center gap-1.5 shadow transition-all">
                  <UploadCloud className="w-4 h-4" />
                  <span>Choose Photo File</span>
                  <input type="file" accept="image/*" onChange={handlePhotoUpload} className="hidden" />
                </label>

                <input
                  type="text"
                  value={avatar}
                  onChange={e => setAvatar(e.target.value)}
                  placeholder="Or paste photo URL..."
                  className="w-full bg-white border border-slate-300 rounded-xl p-2 text-[11px] font-medium text-slate-800"
                />
              </div>
            </div>
          </div>

          <div>
            <label className="block text-slate-700 font-bold mb-1">Technician Full Name</label>
            <input required type="text" value={name} onChange={e => setName(e.target.value)} className="w-full bg-slate-50 border border-slate-300 rounded-xl p-2.5 text-slate-900 font-bold" />
          </div>

          <div>
            <label className="block text-slate-700 font-bold mb-1">Mobile Phone Number</label>
            <input required type="text" value={phone} onChange={e => setPhone(e.target.value)} className="w-full bg-slate-50 border border-slate-300 rounded-xl p-2.5 text-slate-900 font-bold" />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-slate-700 font-bold mb-1">Status</label>
              <select value={status} onChange={e => setStatus(e.target.value)} className="w-full bg-slate-50 border border-slate-300 rounded-xl p-2.5 text-slate-900 font-bold">
                <option value="AVAILABLE">AVAILABLE (On Call)</option>
                <option value="ON_SITE">ON_SITE (Assigned)</option>
                <option value="OFF_DUTY">OFF_DUTY</option>
              </select>
            </div>

            <div>
              <label className="block text-slate-700 font-bold mb-1">Rating (1.0 - 5.0)</label>
              <input type="number" step="0.1" min="1.0" max="5.0" value={rating} onChange={e => setRating(e.target.value)} className="w-full bg-slate-50 border border-slate-300 rounded-xl p-2.5 text-slate-900 font-bold" />
            </div>
          </div>

          <div className="pt-2 flex gap-3">
            <button type="button" onClick={onClose} className="flex-1 bg-slate-200 hover:bg-slate-300 text-slate-800 font-bold py-3 rounded-xl cursor-pointer">
              Cancel
            </button>
            <button type="submit" className="flex-1 bg-[#0286cd] hover:bg-[#026fa8] text-white font-extrabold py-3 rounded-xl shadow-md transition-all cursor-pointer">
              SAVE CHANGES
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

/* =========================================================================
   DYNAMIC ADMIN CONFIGURATION STUDIO (ZERO-CODE RULES ENGINE)
   ========================================================================= */
function DynamicConfigStudio({ config, setConfig }) {
  const [essentialPrice, setEssentialPrice] = useState(config.membershipPlans?.[0]?.price || 99);
  const [businessPrice, setBusinessPrice] = useState(config.membershipPlans?.[1]?.price || 199);
  const [premiumPrice, setPremiumPrice] = useState(config.membershipPlans?.[2]?.price || 399);
  const [overageRate, setOverageRate] = useState(config.overageHourlyRate || 120);
  const [additionalCalloutFee, setAdditionalCalloutFee] = useState(config.additionalCalloutFee || 30);
  const [disclaimerText, setDisclaimerText] = useState(config.toiletOverflowDisclaimer);
  const [savedSuccess, setSavedSuccess] = useState(false);

  const handleSave = async () => {
    const updatedPlans = (config.membershipPlans || []).map(p => {
      if (p.id === 'essential') return { ...p, price: Number(essentialPrice) };
      if (p.id === 'business') return { ...p, price: Number(businessPrice) };
      if (p.id === 'premium') return { ...p, price: Number(premiumPrice) };
      return p;
    });

    const updatedConfig = { 
      ...config, 
      membershipPlans: updatedPlans,
      overageHourlyRate: Number(overageRate),
      additionalCalloutFee: Number(additionalCalloutFee),
      toiletOverflowDisclaimer: disclaimerText 
    };

    try {
      const res = await fetch(`${API_BASE}/config`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updatedConfig)
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        alert(data.error || 'The configuration was not saved.');
        return;
      }
      setConfig(updatedConfig);
      setSavedSuccess(true);
      setTimeout(() => setSavedSuccess(false), 3000);
    } catch (e) {
      alert('Network error: Unable to reach the server. The configuration was not saved.');
    }
  };

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      <div className="bg-white p-6 rounded-2xl space-y-2 border border-slate-200 shadow-md">
        <h2 className="text-xl font-bold text-slate-900 flex items-center gap-2">
          <Settings className="w-6 h-6 text-emerald-600" />
          Zero-Code Admin Configuration Studio
        </h2>
        <p className="text-xs text-slate-600">
          Modify membership plan pricing, call-out allowances, hourly overage rates, and policy disclaimers live without redeploying code.
        </p>
      </div>

      {/* Plan Pricing Editor */}
      <div className="bg-white p-6 rounded-2xl space-y-4 border border-slate-200 shadow-md">
        <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wider text-[#0286cd]">
          Membership Plan Monthly Pricing ($AUD)
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
          <div>
            <label className="block text-slate-700 font-semibold mb-1">Essential Plan ($/mo)</label>
            <input 
              type="number"
              value={essentialPrice}
              onChange={(e) => setEssentialPrice(e.target.value)}
              className="w-full bg-slate-50 border border-slate-300 rounded-xl p-3 text-slate-900 focus:outline-none focus:border-[#0286cd] font-semibold"
            />
          </div>

          <div>
            <label className="block text-slate-700 font-semibold mb-1">Business Plan ($/mo)</label>
            <input 
              type="number"
              value={businessPrice}
              onChange={(e) => setBusinessPrice(e.target.value)}
              className="w-full bg-slate-50 border border-slate-300 rounded-xl p-3 text-slate-900 focus:outline-none focus:border-[#0286cd] font-semibold"
            />
          </div>

          <div>
            <label className="block text-slate-700 font-semibold mb-1">Premium Plan ($/mo)</label>
            <input 
              type="number"
              value={premiumPrice}
              onChange={(e) => setPremiumPrice(e.target.value)}
              className="w-full bg-slate-50 border border-slate-300 rounded-xl p-3 text-slate-900 focus:outline-none focus:border-[#0286cd] font-semibold"
            />
          </div>
        </div>
      </div>

      {/* Overage Rates Editor */}
      <div className="bg-white p-6 rounded-2xl space-y-4 border border-slate-200 shadow-md">
        <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wider text-[#0286cd]">
          Overage & Additional Call-out Fee Rates ($AUD)
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
          <div>
            <label className="block text-slate-700 font-semibold mb-1">Overage Labour Hourly Rate ($/hr)</label>
            <input 
              type="number"
              value={overageRate}
              onChange={(e) => setOverageRate(e.target.value)}
              className="w-full bg-slate-50 border border-slate-300 rounded-xl p-3 text-slate-900 focus:outline-none focus:border-[#0286cd] font-semibold"
            />
          </div>

          <div>
            <label className="block text-slate-700 font-semibold mb-1">Additional Call-out Base Fee ($)</label>
            <input 
              type="number"
              value={additionalCalloutFee}
              onChange={(e) => setAdditionalCalloutFee(e.target.value)}
              className="w-full bg-slate-50 border border-slate-300 rounded-xl p-3 text-slate-900 focus:outline-none focus:border-[#0286cd] font-semibold"
            />
          </div>
        </div>
      </div>

      {/* Toilet Overflow Policy Disclaimer Editor */}
      <div className="bg-white p-6 rounded-2xl space-y-4 border border-slate-200 shadow-md">
        <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wider text-[#0286cd]">
          Toilet Overflow Policy Disclaimer Text
        </h3>
        <textarea
          rows={3}
          value={disclaimerText}
          onChange={(e) => setDisclaimerText(e.target.value)}
          className="w-full bg-slate-50 border border-slate-300 rounded-xl p-3.5 text-xs text-slate-900 focus:outline-none focus:border-[#0286cd] font-medium"
        />
        <div className="flex items-center justify-between">
          {savedSuccess && <span className="text-xs text-emerald-600 font-bold">✅ Rules saved to Database!</span>}
          <button
            onClick={handleSave}
            className="ml-auto bg-[#0286cd] hover:bg-[#026fa8] text-white font-bold py-2.5 px-5 rounded-xl text-xs transition-all shadow cursor-pointer"
          >
            Save All Configuration Rules
          </button>
        </div>
      </div>
    </div>
  );
}

/* =========================================================================
   MODAL: COMPANY MULTI-STEP REGISTRATION (ADELAIDE ONLY)
   ========================================================================= */
const ADELAIDE_LOCATIONS = [
  { suburb: 'Adelaide CBD', postcode: '5000' },
  { suburb: 'North Adelaide', postcode: '5006' },
  { suburb: 'Port Adelaide', postcode: '5015' },
  { suburb: 'Norwood', postcode: '5067' },
  { suburb: 'Unley', postcode: '5061' },
  { suburb: 'Glenelg', postcode: '5045' },
  { suburb: 'Mawson Lakes', postcode: '5095' },
  { suburb: 'Marion', postcode: '5043' },
  { suburb: 'Salisbury', postcode: '5108' },
  { suburb: 'Elizabeth', postcode: '5112' },
  { suburb: 'Prospect', postcode: '5082' },
  { suburb: 'Modbury', postcode: '5092' }
];

function CompanyRegistrationModal({ onClose, onRegisterSuccess, isAdminMode = false, config }) {
  const [step, setStep] = useState(1);
  const [businessName, setBusinessName] = useState('');
  const [abn, setAbn] = useState('');
  const [primaryContactName, setPrimaryContactName] = useState('');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [email, setEmail] = useState('');
  
  // Location state (Adelaide restricted)
  const [locationName, setLocationName] = useState('Primary Adelaide Office');
  const [selectedSuburb, setSelectedSuburb] = useState('Adelaide CBD (5000)');
  const [streetAddress, setStreetAddress] = useState('');
  const [locationError, setLocationError] = useState('');

  // T&C State
  const [agreedToTerms, setAgreedToTerms] = useState(false);

  // Package State
  const [selectedPlan, setSelectedPlan] = useState('business');

  // Payment State
  const [paymentType, setPaymentType] = useState('DIRECT_DEBIT'); // DIRECT_DEBIT or CREDIT_CARD
  const [bsb, setBsb] = useState('105-000');
  const [accountNumber, setAccountNumber] = useState('12345678');
  const [accountName, setAccountName] = useState('');
  const [cardNumber, setCardNumber] = useState('');
  const [cardExpiry, setCardExpiry] = useState('12/28');
  const [cardCvc, setCardCvc] = useState('');

  // Login password. Public sign-up: the customer chooses it. Admin mode: a random temporary password the admin passes on.
  const [adminPassword, setAdminPassword] = useState(() => {
    if (!isAdminMode) return '';
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789';
    let out = '';
    const rnd = new Uint32Array(10);
    window.crypto.getRandomValues(rnd);
    rnd.forEach(n => { out += chars[n % chars.length]; });
    return `${out}!7`;
  });
  const [confirmPassword, setConfirmPassword] = useState('');
  
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState('');

  const validateAdelaideLocation = () => {
    setLocationError('');
    const fullAddress = `${streetAddress} ${selectedSuburb}`.toLowerCase();
    if (!streetAddress || streetAddress.trim().length < 4) {
      setLocationError('Please enter a valid street address in Adelaide (at least 4 characters).');
      return false;
    }
    if (!fullAddress.includes('adelaide') && !fullAddress.includes('sa') && !fullAddress.includes('5')) {
      setLocationError('Location Error: Emergency Cleaning Membership is strictly restricted exclusively to Adelaide, South Australia locations (Postcodes 5000-5199).');
      return false;
    }
    return true;
  };

  const validateStep1 = () => {
    setSubmitError('');
    if (!businessName || businessName.trim().length < 2) {
      setSubmitError('Validation Error: Business/Company Name is required (at least 2 characters).');
      return false;
    }
    const cleanAbn = abn.replace(/\s/g, '');
    if (!cleanAbn || !/^\d{11}$/.test(cleanAbn)) {
      setSubmitError('Validation Error: Australian Business Number (ABN) must be exactly 11 digits.');
      return false;
    }
    if (!primaryContactName || primaryContactName.trim().length < 2) {
      setSubmitError('Validation Error: Primary Contact Representative Name is required.');
      return false;
    }
    const cleanPhone = phoneNumber.replace(/[\s\-\(\)\+]/g, '');
    if (!cleanPhone || !/^\d{8,12}$/.test(cleanPhone)) {
      setSubmitError('Validation Error: Please enter a valid phone number (8 to 12 digits).');
      return false;
    }
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!email || !emailRegex.test(email.trim())) {
      setSubmitError('Validation Error: Please enter a valid business email address.');
      return false;
    }
    if (!isAdminMode) {
      if (!adminPassword || adminPassword.length < 8) {
        setSubmitError('Validation Error: Password must be at least 8 characters.');
        return false;
      }
      if (adminPassword !== confirmPassword) {
        setSubmitError('Validation Error: The two passwords do not match.');
        return false;
      }
    }
    if (!validateAdelaideLocation()) return false;
    return true;
  };

  const handleNextStep = (e) => {
    e.preventDefault();
    if (step === 1) {
      if (!validateStep1()) return;
      setStep(2);
    } else if (step === 2) {
      if (!agreedToTerms) {
        setSubmitError('Validation Error: You must review and accept the SACC Service Level Agreement to proceed.');
        return;
      }
      setSubmitError('');
      setStep(3);
    } else if (step === 3) {
      setStep(4);
    } else if (step === 4) {
      if (isAdminMode) {
        setStep(5); // Admin step for setting company credentials
      } else {
        handleFinalRegister();
      }
    }
  };

  const handleFinalRegister = async () => {
    setSubmitting(true);
    setSubmitError('');

    const fullAddressString = `${streetAddress}, ${selectedSuburb}, SA`;
    const payload = {
      businessName,
      abn: abn || '48 123 456 789',
      primaryContactName,
      phoneNumber,
      email,
      password: adminPassword,
      membershipPlan: selectedPlan,
      paymentType,
      paymentDetails: paymentType === 'CREDIT_CARD' ? { cardNumber, cardExpiry, cardCvc } : { bsb, accountNumber, accountName },
      address: fullAddressString,
      locationName,
      isCreatedByAdmin: isAdminMode
    };

    try {
      const res = await fetch(`${API_BASE}/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const data = await res.json();
      setSubmitting(false);

      if (res.ok && data.customer) {
        onRegisterSuccess(data.customer, payload);
      } else {
        setSubmitError(data.error || 'Failed to complete registration.');
      }
    } catch (err) {
      setSubmitting(false);
      // No offline fake: the company only exists once the server has saved it
      setSubmitError('Cannot reach the server. Your registration was not saved. Please try again.');
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-4">
      <div className="bg-white max-w-2xl w-full p-6 md:p-8 rounded-3xl space-y-6 border border-slate-200 shadow-2xl text-xs text-slate-800 relative max-h-[90vh] overflow-y-auto">
        {/* Modal Header */}
        <div className="flex items-center justify-between border-b border-slate-200 pb-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="text-[10px] uppercase font-bold tracking-wider px-2.5 py-0.5 rounded-full bg-[#0286cd]/10 text-[#0286cd]">
                {isAdminMode ? 'System Admin Action' : 'Company Registration Wizard'}
              </span>
              <span className="text-[10px] text-slate-400">Step {step} of {isAdminMode ? 5 : 4}</span>
            </div>
            <h3 className="text-xl font-black text-slate-900 mt-1 flex items-center gap-2">
              <Building className="w-5 h-5 text-[#0286cd]" />
              {isAdminMode ? 'Register Company & Issue Credentials' : 'Register SA Emergency Cleaning Membership'}
            </h3>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-700 cursor-pointer p-1 rounded-lg hover:bg-slate-100">
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* Progress Bar Indicator */}
        <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden border border-slate-200">
          <div 
            className="bg-[#0286cd] h-full transition-all duration-300"
            style={{ width: `${(step / (isAdminMode ? 5 : 4)) * 100}%` }}
          ></div>
        </div>

        {submitError && (
          <div className="p-3 bg-red-50 border border-red-200 text-red-700 rounded-xl flex items-center gap-2 font-medium">
            <AlertCircle className="w-4 h-4 shrink-0 text-red-600" />
            <span>{submitError}</span>
          </div>
        )}

        {/* STEP 1: COMPANY NAME, ADDRESS & ADELAIDE LOCATION */}
        {step === 1 && (
          <form onSubmit={handleNextStep} className="space-y-4">
            <div className="bg-blue-50 border border-blue-200 p-3 rounded-xl flex items-center gap-2 text-blue-900 font-medium">
              <MapPin className="w-4 h-4 text-[#0286cd] shrink-0" />
              <span>Note: Service coverage is restricted exclusively to <strong>Adelaide, South Australia</strong> commercial locations.</span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-slate-700 font-bold mb-1">Company / Business Name *</label>
                <input
                  type="text"
                  required
                  value={businessName}
                  onChange={(e) => setBusinessName(e.target.value)}
                  placeholder="e.g. Adelaide Innovation Tech Hub Pty Ltd"
                  className="w-full bg-slate-50 border border-slate-300 rounded-xl p-3 text-slate-900 font-medium focus:border-[#0286cd] focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-slate-700 font-bold mb-1">Australian Business Number (ABN)</label>
                <input
                  type="text"
                  value={abn}
                  onChange={(e) => setAbn(e.target.value)}
                  placeholder="48 123 456 789"
                  className="w-full bg-slate-50 border border-slate-300 rounded-xl p-3 text-slate-900 font-medium focus:border-[#0286cd] focus:outline-none"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-slate-700 font-bold mb-1">Primary Contact Name *</label>
                <input
                  type="text"
                  required
                  value={primaryContactName}
                  onChange={(e) => setPrimaryContactName(e.target.value)}
                  placeholder="Sarah Jenkins"
                  className="w-full bg-slate-50 border border-slate-300 rounded-xl p-3 text-slate-900 font-medium focus:border-[#0286cd] focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-slate-700 font-bold mb-1">Phone Number *</label>
                <input
                  type="text"
                  required
                  value={phoneNumber}
                  onChange={(e) => setPhoneNumber(e.target.value)}
                  placeholder="0412 345 678"
                  className="w-full bg-slate-50 border border-slate-300 rounded-xl p-3 text-slate-900 font-medium focus:border-[#0286cd] focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-slate-700 font-bold mb-1">Company Email *</label>
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="contact@company.com.au"
                  className="w-full bg-slate-50 border border-slate-300 rounded-xl p-3 text-slate-900 font-medium focus:border-[#0286cd] focus:outline-none"
                />
              </div>

              {!isAdminMode && (
                <>
                  <div>
                    <label className="block text-slate-700 font-bold mb-1">Login Password * (at least 8 characters)</label>
                    <input
                      type="password"
                      required
                      value={adminPassword}
                      onChange={(e) => setAdminPassword(e.target.value)}
                      autoComplete="new-password"
                      className="w-full bg-slate-50 border border-slate-300 rounded-xl p-3 text-slate-900 font-medium focus:border-[#0286cd] focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-slate-700 font-bold mb-1">Confirm Password *</label>
                    <input
                      type="password"
                      required
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      autoComplete="new-password"
                      className="w-full bg-slate-50 border border-slate-300 rounded-xl p-3 text-slate-900 font-medium focus:border-[#0286cd] focus:outline-none"
                    />
                  </div>
                </>
              )}
            </div>

            {/* ADELAIDE LOCATION SELECTION */}
            <div className="pt-2 border-t border-slate-200">
              <h4 className="font-bold text-slate-900 text-sm mb-2 flex items-center gap-1.5">
                <MapPin className="w-4 h-4 text-[#0286cd]" />
                Primary Site Location (Adelaide, Australia Only)
              </h4>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-slate-700 font-bold mb-1">Site / Facility Name</label>
                  <input
                    type="text"
                    value={locationName}
                    onChange={(e) => setLocationName(e.target.value)}
                    placeholder="Adelaide Headquarters"
                    className="w-full bg-slate-50 border border-slate-300 rounded-xl p-3 text-slate-900 font-medium focus:border-[#0286cd] focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-slate-700 font-bold mb-1">Select Adelaide Suburb & Postcode *</label>
                  <select
                    value={selectedSuburb}
                    onChange={(e) => setSelectedSuburb(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-300 rounded-xl p-3 text-slate-900 font-bold focus:border-[#0286cd] focus:outline-none text-[#0286cd]"
                  >
                    {ADELAIDE_LOCATIONS.map((loc, i) => (
                      <option key={i} value={`${loc.suburb} (${loc.postcode})`}>
                        📍 {loc.suburb}, SA {loc.postcode} (Adelaide)
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="mt-3">
                <label className="block text-slate-700 font-bold mb-1">Street Address in Adelaide *</label>
                <input
                  type="text"
                  required
                  value={streetAddress}
                  onChange={(e) => setStreetAddress(e.target.value)}
                  placeholder="e.g. 120 Grenfell Street, Adelaide SA 5000"
                  className="w-full bg-slate-50 border border-slate-300 rounded-xl p-3 text-slate-900 font-medium focus:border-[#0286cd] focus:outline-none"
                />
              </div>

              {locationError && (
                <div className="mt-2 p-3 bg-red-50 border border-red-200 text-red-700 rounded-xl font-semibold flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 text-red-600 shrink-0" />
                  <span>{locationError}</span>
                </div>
              )}
            </div>

            <div className="pt-4 flex justify-end gap-3">
              <button
                type="button"
                onClick={onClose}
                className="px-5 py-3 rounded-xl border border-slate-300 font-bold text-slate-600 hover:bg-slate-50 cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-6 py-3 rounded-xl bg-[#0286cd] hover:bg-[#026fa8] text-white font-extrabold flex items-center gap-2 shadow-md cursor-pointer"
              >
                <span>Continue to Terms & Conditions</span>
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </form>
        )}

        {/* STEP 2: TERMS AND CONDITIONS CHECK */}
        {step === 2 && (
          <div className="space-y-4">
            <h4 className="font-bold text-slate-900 text-sm flex items-center gap-1.5">
              <FileCheck className="w-4 h-4 text-[#0286cd]" />
              SA Commercial Cleaning Membership Terms & Conditions
            </h4>

            <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200 space-y-3 max-h-56 overflow-y-auto text-[11px] text-slate-700 leading-relaxed font-normal">
              <p className="font-bold text-slate-900">1. Coverage & Response Time (SLA)</p>
              <p>SA Commercial Cleaning Services Pty Ltd (SACC) provides emergency cleaning dispatch for registered business accounts located within Adelaide, South Australia. Target attendance is 2 to 4 hours from emergency submission.</p>

              <p className="font-bold text-slate-900">2. Call-out Labor Allowance</p>
              <p>Each included call-out covers initial dispatch and up to 1 hour of emergency cleaning labor. Subsequent labor is billed at standard overage rates ($120/hr).</p>

              <p className="font-bold text-slate-900">3. Plumbing & Drainage Disclaimer</p>
              <p>SACC provides cleaning of affected surfaces only. SACC does not provide plumbing, pipe unblocking, drain clearing, or toilet unclogging services.</p>

              <p className="font-bold text-slate-900">4. Tenure & Cancellation Policy</p>
              <p>Memberships carry a 6-month minimum tenure requirement. Points redemptions unlock after 6 consecutive active months.</p>
            </div>

            <label className="flex items-start gap-3 bg-blue-50 p-4 rounded-xl border border-blue-200 cursor-pointer">
              <input
                type="checkbox"
                checked={agreedToTerms}
                onChange={(e) => setAgreedToTerms(e.target.checked)}
                className="mt-0.5 w-4 h-4 text-[#0286cd] rounded border-slate-300 focus:ring-[#0286cd]"
              />
              <span className="font-bold text-slate-900 text-xs">
                I have read and agree to the SA Commercial Cleaning Membership Terms & Conditions, 6-month tenure requirement, and emergency callout disclaimers.
              </span>
            </label>

            <div className="pt-4 flex justify-between gap-3">
              <button
                type="button"
                onClick={() => setStep(1)}
                className="px-5 py-3 rounded-xl border border-slate-300 font-bold text-slate-600 hover:bg-slate-50 cursor-pointer"
              >
                Back
              </button>
              <button
                type="button"
                disabled={!agreedToTerms}
                onClick={() => setStep(3)}
                className={`px-6 py-3 rounded-xl font-extrabold flex items-center gap-2 shadow-md cursor-pointer ${
                  agreedToTerms ? 'bg-[#0286cd] hover:bg-[#026fa8] text-white' : 'bg-slate-200 text-slate-400 cursor-not-allowed'
                }`}
              >
                <span>Select Membership Package</span>
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}

        {/* STEP 3: PACKAGE SELECTION */}
        {step === 3 && (
          <div className="space-y-4">
            <h4 className="font-bold text-slate-900 text-sm flex items-center gap-1.5">
              <Award className="w-4 h-4 text-[#0286cd]" />
              Choose Your Emergency Membership Package
            </h4>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {/* Essential */}
              <div 
                onClick={() => setSelectedPlan('essential')}
                className={`p-4 rounded-2xl border-2 cursor-pointer transition-all space-y-3 relative ${
                  selectedPlan === 'essential' ? 'border-[#0286cd] bg-blue-50/50 shadow-md' : 'border-slate-200 hover:border-slate-300 bg-white'
                }`}
              >
                <div className="flex justify-between items-center">
                  <span className="font-bold text-slate-900 text-sm">Essential</span>
                  <input type="radio" checked={selectedPlan === 'essential'} onChange={() => setSelectedPlan('essential')} className="text-[#0286cd]" />
                </div>
                <div className="text-2xl font-black text-slate-900">$99 <span className="text-xs text-slate-500 font-normal">/ month</span></div>
                <ul className="space-y-1.5 text-[11px] text-slate-600 font-medium">
                  <li className="flex items-center gap-1.5"><CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" /> 1 Call-out Included / mo</li>
                  <li className="flex items-center gap-1.5"><CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" /> 2–4 Hr Target Response</li>
                  <li className="flex items-center gap-1.5"><CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" /> Earn 100 pts / month</li>
                </ul>
              </div>

              {/* Business (Recommended) */}
              <div 
                onClick={() => setSelectedPlan('business')}
                className={`p-4 rounded-2xl border-2 cursor-pointer transition-all space-y-3 relative ${
                  selectedPlan === 'business' ? 'border-[#0286cd] bg-blue-50/50 shadow-md' : 'border-slate-200 hover:border-slate-300 bg-white'
                }`}
              >
                <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-[#0286cd] text-white text-[9px] font-black uppercase px-2.5 py-0.5 rounded-full shadow-sm">
                  MOST POPULAR
                </div>
                <div className="flex justify-between items-center">
                  <span className="font-bold text-slate-900 text-sm">Business</span>
                  <input type="radio" checked={selectedPlan === 'business'} onChange={() => setSelectedPlan('business')} className="text-[#0286cd]" />
                </div>
                <div className="text-2xl font-black text-slate-900">$199 <span className="text-xs text-slate-500 font-normal">/ month</span></div>
                <ul className="space-y-1.5 text-[11px] text-slate-600 font-medium">
                  <li className="flex items-center gap-1.5"><CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" /> 2 Call-outs Included / mo</li>
                  <li className="flex items-center gap-1.5"><CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" /> Priority 2–4 Hr Dispatch</li>
                  <li className="flex items-center gap-1.5"><CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" /> Earn 200 pts / month</li>
                </ul>
              </div>

              {/* Premium */}
              <div 
                onClick={() => setSelectedPlan('premium')}
                className={`p-4 rounded-2xl border-2 cursor-pointer transition-all space-y-3 relative ${
                  selectedPlan === 'premium' ? 'border-[#0286cd] bg-blue-50/50 shadow-md' : 'border-slate-200 hover:border-slate-300 bg-white'
                }`}
              >
                <div className="flex justify-between items-center">
                  <span className="font-bold text-slate-900 text-sm">Premium</span>
                  <input type="radio" checked={selectedPlan === 'premium'} onChange={() => setSelectedPlan('premium')} className="text-[#0286cd]" />
                </div>
                <div className="text-2xl font-black text-slate-900">$399 <span className="text-xs text-slate-500 font-normal">/ month</span></div>
                <ul className="space-y-1.5 text-[11px] text-slate-600 font-medium">
                  <li className="flex items-center gap-1.5"><CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" /> 4 Call-outs Included / mo</li>
                  <li className="flex items-center gap-1.5"><CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" /> VIP Rapid Dispatch</li>
                  <li className="flex items-center gap-1.5"><CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" /> Earn 400 pts / month</li>
                </ul>
              </div>
            </div>

            <div className="pt-4 flex justify-between gap-3">
              <button
                type="button"
                onClick={() => setStep(2)}
                className="px-5 py-3 rounded-xl border border-slate-300 font-bold text-slate-600 hover:bg-slate-50 cursor-pointer"
              >
                Back
              </button>
              <button
                type="button"
                onClick={() => setStep(4)}
                className="px-6 py-3 rounded-xl bg-[#0286cd] hover:bg-[#026fa8] text-white font-extrabold flex items-center gap-2 shadow-md cursor-pointer"
              >
                <span>Proceed to Payment</span>
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}

        {/* STEP 4: PAYMENT SCREEN (DIRECT DEBIT & CREDIT CARD) */}
        {step === 4 && (
          <div className="space-y-4">
            <h4 className="font-bold text-slate-900 text-sm flex items-center gap-1.5">
              <DollarSign className="w-4 h-4 text-[#0286cd]" />
              Select Preferred Payment Method
            </h4>

            {/* Payment Method Selector Tabs */}
            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => setPaymentType('DIRECT_DEBIT')}
                className={`p-3.5 rounded-xl border-2 font-extrabold text-xs flex items-center justify-center gap-2 transition-all cursor-pointer ${
                  paymentType === 'DIRECT_DEBIT'
                    ? 'border-[#0286cd] bg-blue-50 text-[#0286cd] shadow-sm'
                    : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
                }`}
              >
                <Building className="w-4 h-4" />
                Direct Debit (PayTo / Bank)
              </button>

              <button
                type="button"
                onClick={() => setPaymentType('CREDIT_CARD')}
                className={`p-3.5 rounded-xl border-2 font-extrabold text-xs flex items-center justify-center gap-2 transition-all cursor-pointer ${
                  paymentType === 'CREDIT_CARD'
                    ? 'border-[#0286cd] bg-blue-50 text-[#0286cd] shadow-sm'
                    : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
                }`}
              >
                <DollarSign className="w-4 h-4" />
                Credit / Debit Card
              </button>
            </div>

            {/* Direct Debit Form Fields */}
            {paymentType === 'DIRECT_DEBIT' && (
              <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200 space-y-3">
                <span className="text-[10px] text-emerald-700 bg-emerald-100 font-bold px-2 py-0.5 rounded border border-emerald-200 uppercase">
                  PayTo Direct Debit Authorization
                </span>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-slate-700 font-bold mb-1">BSB Number</label>
                    <input
                      type="text"
                      value={bsb}
                      onChange={(e) => setBsb(e.target.value)}
                      placeholder="105-000"
                      className="w-full bg-white border border-slate-300 rounded-xl p-2.5 text-slate-900 font-mono font-bold"
                    />
                  </div>
                  <div>
                    <label className="block text-slate-700 font-bold mb-1">Account Number</label>
                    <input
                      type="text"
                      value={accountNumber}
                      onChange={(e) => setAccountNumber(e.target.value)}
                      placeholder="12345678"
                      className="w-full bg-white border border-slate-300 rounded-xl p-2.5 text-slate-900 font-mono font-bold"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-slate-700 font-bold mb-1">Account Holder Name</label>
                  <input
                    type="text"
                    value={accountName || businessName}
                    onChange={(e) => setAccountName(e.target.value)}
                    placeholder="Company Account Name..."
                    className="w-full bg-white border border-slate-300 rounded-xl p-2.5 text-slate-900 font-medium"
                  />
                </div>
              </div>
            )}

            {/* Credit Card Form Fields */}
            {paymentType === 'CREDIT_CARD' && (
              <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200 space-y-3">
                <span className="text-[10px] text-blue-700 bg-blue-100 font-bold px-2 py-0.5 rounded border border-blue-200 uppercase">
                  Secure Credit Card Billing
                </span>
                <div>
                  <label className="block text-slate-700 font-bold mb-1">Card Number</label>
                  <input
                    type="text"
                    value={cardNumber}
                    onChange={(e) => setCardNumber(e.target.value)}
                    placeholder="4532 •••• •••• 8892"
                    className="w-full bg-white border border-slate-300 rounded-xl p-2.5 text-slate-900 font-mono font-bold"
                  />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-slate-700 font-bold mb-1">Expiry Date</label>
                    <input
                      type="text"
                      value={cardExpiry}
                      onChange={(e) => setCardExpiry(e.target.value)}
                      placeholder="MM/YY"
                      className="w-full bg-white border border-slate-300 rounded-xl p-2.5 text-slate-900 font-mono font-bold"
                    />
                  </div>
                  <div>
                    <label className="block text-slate-700 font-bold mb-1">CVC Code</label>
                    <input
                      type="text"
                      value={cardCvc}
                      onChange={(e) => setCardCvc(e.target.value)}
                      placeholder="123"
                      className="w-full bg-white border border-slate-300 rounded-xl p-2.5 text-slate-900 font-mono font-bold"
                    />
                  </div>
                </div>
              </div>
            )}

            <div className="pt-4 flex justify-between gap-3">
              <button
                type="button"
                onClick={() => setStep(3)}
                className="px-5 py-3 rounded-xl border border-slate-300 font-bold text-slate-600 hover:bg-slate-50 cursor-pointer"
              >
                Back
              </button>

              {isAdminMode ? (
                <button
                  type="button"
                  onClick={() => setStep(5)}
                  className="px-6 py-3 rounded-xl bg-[#0286cd] hover:bg-[#026fa8] text-white font-extrabold flex items-center gap-2 shadow-md cursor-pointer"
                >
                  <span>Set Credentials (Admin)</span>
                  <ChevronRight className="w-4 h-4" />
                </button>
              ) : (
                <button
                  type="button"
                  disabled={submitting}
                  onClick={handleFinalRegister}
                  className="px-8 py-3.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-black text-xs flex items-center gap-2 shadow-lg shadow-emerald-600/30 cursor-pointer"
                >
                  {submitting ? <RefreshCw className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
                  <span>COMPLETE REGISTRATION & ACTIVATE</span>
                </button>
              )}
            </div>
          </div>
        )}

        {/* STEP 5: (SYSTEM ADMIN MODE ONLY) CREATE CREDENTIALS */}
        {step === 5 && isAdminMode && (
          <div className="space-y-4">
            <div className="bg-amber-50 border border-amber-200 p-3.5 rounded-2xl space-y-1">
              <span className="text-[10px] font-bold uppercase text-amber-800 tracking-wider">System Admin Capability</span>
              <h4 className="font-bold text-amber-900 text-xs">Set Initial Login Credentials for {businessName || 'Company'}</h4>
              <p className="text-[11px] text-amber-700">System Admin creates the official login password. The credentials will be assigned to <strong>{email}</strong>.</p>
            </div>

            <div>
              <label className="block text-slate-700 font-bold mb-1">Company Access Password *</label>
              <input
                type="text"
                required
                value={adminPassword}
                onChange={(e) => setAdminPassword(e.target.value)}
                className="w-full bg-slate-50 border border-slate-300 rounded-xl p-3 text-slate-900 font-mono font-bold"
              />
            </div>

            <div className="pt-4 flex justify-between gap-3">
              <button
                type="button"
                onClick={() => setStep(4)}
                className="px-5 py-3 rounded-xl border border-slate-300 font-bold text-slate-600 hover:bg-slate-50 cursor-pointer"
              >
                Back
              </button>
              <button
                type="button"
                disabled={submitting}
                onClick={handleFinalRegister}
                className="px-8 py-3.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-black text-xs flex items-center gap-2 shadow-lg shadow-emerald-600/30 cursor-pointer"
              >
                {submitting ? <RefreshCw className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
                <span>REGISTER COMPANY & CREATE CREDENTIALS</span>
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

/* =========================================================================
   MODAL: COMPANY PROFILE & PASSWORD UPDATE
   ========================================================================= */
function CompanyProfileModal({ account, onClose, onUpdateSuccess, onSitesChanged, handleLogout }) {
  const [businessName, setBusinessName] = useState(account.businessName || '');
  const [primaryContactName, setPrimaryContactName] = useState(account.primaryContactName || account.primaryContact || '');
  const [phoneNumber, setPhoneNumber] = useState(account.phoneNumber || account.phone || '');
  const [email, setEmail] = useState(account.email || '');
  const [newPassword, setNewPassword] = useState('');
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [msg, setMsg] = useState('');

  const handleDeleteAccount = async () => {
    if (!window.confirm("WARNING: Are you sure you want to permanently delete your account and all associated data? This action cannot be undone and complies with Apple App Store review guidelines.")) return;
    setDeleting(true);
    setMsg('');
    try {
      const res = await fetch(`${API_BASE}/customers/${account.id}`, { method: 'DELETE' });
      if (res.ok) {
        alert("Account deleted successfully.");
        if (handleLogout) handleLogout();
      } else {
        const data = await res.json();
        setMsg(data.error || 'Failed to delete account.');
        setDeleting(false);
      }
    } catch (err) {
      setMsg("Network error occurred while trying to delete the account.");
      setDeleting(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    setMsg('');

    try {
      const res = await fetch(`${API_BASE}/customers/${account.id}/profile`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ businessName, primaryContactName, phoneNumber, email, password: newPassword || undefined })
      });
      const data = await res.json();
      setSaving(false);
      if (res.ok && data.customer) {
        onUpdateSuccess(data.customer);
      } else {
        setMsg(data.error || 'Failed to update profile.');
      }
    } catch (err) {
      setSaving(false);
      setMsg('Network error: Unable to update profile on server.');
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-4">
      <div className="bg-white max-w-lg w-full p-6 rounded-3xl space-y-5 border border-slate-200 shadow-2xl text-xs text-slate-800 max-h-[92vh] overflow-y-auto custom-scroll-container">
        <div className="flex items-center justify-between border-b border-slate-200 pb-3">
          <h3 className="text-lg font-bold text-slate-900 flex items-center gap-2">
            <User className="w-5 h-5 text-[#0286cd]" />
            Company Profile & Account Security
          </h3>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-700 cursor-pointer"><X className="w-5 h-5" /></button>
        </div>

        {msg && <div className="p-3 bg-red-50 text-red-700 rounded-xl font-medium">{msg}</div>}

        <form onSubmit={handleSubmit} className="space-y-3">
          <div>
            <label className="block text-slate-700 font-bold mb-1">Company Name</label>
            <input type="text" required value={businessName} onChange={e => setBusinessName(e.target.value)} className="w-full bg-slate-50 border border-slate-300 rounded-xl p-2.5 text-slate-900 font-medium" />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-slate-700 font-bold mb-1">Primary Contact</label>
              <input type="text" required value={primaryContactName} onChange={e => setPrimaryContactName(e.target.value)} className="w-full bg-slate-50 border border-slate-300 rounded-xl p-2.5 text-slate-900 font-medium" />
            </div>
            <div>
              <label className="block text-slate-700 font-bold mb-1">Phone Number</label>
              <input type="text" required value={phoneNumber} onChange={e => setPhoneNumber(e.target.value)} className="w-full bg-slate-50 border border-slate-300 rounded-xl p-2.5 text-slate-900 font-medium" />
            </div>
          </div>

          <div>
            <label className="block text-slate-700 font-bold mb-1">Email Address</label>
            <input type="email" required value={email} onChange={e => setEmail(e.target.value)} className="w-full bg-slate-50 border border-slate-300 rounded-xl p-2.5 text-slate-900 font-medium" />
          </div>

          <div className="pt-2 border-t border-slate-200">
            <label className="block text-slate-700 font-bold mb-1">Update Password (Optional)</label>
            <input type="password" placeholder="Leave blank to keep current password" value={newPassword} onChange={e => setNewPassword(e.target.value)} className="w-full bg-slate-50 border border-slate-300 rounded-xl p-2.5 text-slate-900 font-medium" />
          </div>

          <div className="pt-3 flex justify-between gap-2 border-t border-slate-200 mt-4">
            <button type="button" onClick={handleDeleteAccount} disabled={deleting} className="px-4 py-2 rounded-xl bg-red-100 hover:bg-red-200 text-red-700 font-bold cursor-pointer transition-colors flex items-center gap-2">
              <Trash2 className="w-4 h-4" /> {deleting ? 'Deleting...' : 'Delete Account'}
            </button>
            <div className="flex gap-2">
              <button type="button" onClick={onClose} className="px-4 py-2 rounded-xl border border-slate-300 font-bold text-slate-600 hover:bg-slate-50 cursor-pointer">Cancel</button>
              <button type="submit" disabled={saving || deleting} className="px-6 py-2.5 rounded-xl bg-[#0286cd] hover:bg-[#026fa8] text-white font-extrabold cursor-pointer shadow-md">
                {saving ? 'Saving...' : 'Save Profile Changes'}
              </button>
            </div>
          </div>
        </form>

        <ManageSitesSection account={account} onSitesChanged={onSitesChanged} />
      </div>
    </div>
  );
}

/* =========================================================================
   MULTI-SITE MANAGEMENT: list, add and edit a company's sites (saved to the Location table)
   ========================================================================= */
function ManageSitesSection({ account, onSitesChanged }) {
  const emptySite = { name: '', address: '', contactName: '', contactPhone: '', accessInstructions: '', securityNotes: '' };
  const [sites, setSites] = useState(account.locations || []);
  const [editingId, setEditingId] = useState(null); // null = closed, 'new' = add form, otherwise a location id
  const [form, setForm] = useState(emptySite);
  const [busy, setBusy] = useState(false);
  const [siteMsg, setSiteMsg] = useState('');

  const openForm = (site) => {
    setSiteMsg('');
    setEditingId(site ? site.id : 'new');
    setForm(site ? {
      name: site.name || '', address: site.address || '', contactName: site.contactName || '',
      contactPhone: site.contactPhone || '', accessInstructions: site.accessInstructions || '', securityNotes: site.securityNotes || ''
    } : emptySite);
  };

  const saveSite = async (e) => {
    e.preventDefault();
    setBusy(true);
    setSiteMsg('');
    try {
      const isNew = editingId === 'new';
      const res = await fetch(isNew ? `${API_BASE}/customers/${account.id}/locations` : `${API_BASE}/locations/${editingId}`, {
        method: isNew ? 'POST' : 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form)
      });
      const data = await res.json();
      setBusy(false);
      if (!res.ok) {
        setSiteMsg(data.error || 'The site could not be saved.');
        return;
      }
      const nextSites = isNew ? [...sites, data] : sites.map(s => s.id === data.id ? data : s);
      setSites(nextSites);
      setEditingId(null);
      if (onSitesChanged) onSitesChanged({ ...account, locations: nextSites });
    } catch (err) {
      setBusy(false);
      setSiteMsg('Network error: Unable to reach the server. The site was not saved.');
    }
  };

  const field = (key, label, required = false) => (
    <div>
      <label className="block text-slate-700 font-bold mb-1">{label}{required ? ' *' : ''}</label>
      <input
        type="text"
        required={required}
        value={form[key]}
        onChange={e => setForm({ ...form, [key]: e.target.value })}
        className="w-full bg-slate-50 border border-slate-300 rounded-xl p-2.5 text-slate-900 font-medium"
      />
    </div>
  );

  return (
    <div className="pt-4 border-t border-slate-200 space-y-3">
      <div className="flex items-center justify-between">
        <h4 className="font-bold text-slate-900 text-sm flex items-center gap-1.5">
          <MapPin className="w-4 h-4 text-[#0286cd]" /> Service Sites ({sites.length})
        </h4>
        {editingId === null && (
          <button type="button" onClick={() => openForm(null)} className="px-3 py-1.5 rounded-xl bg-[#0286cd] hover:bg-[#026fa8] text-white font-bold cursor-pointer flex items-center gap-1">
            <Plus className="w-3.5 h-3.5" /> Add Site
          </button>
        )}
      </div>

      {siteMsg && <div className="p-3 bg-red-50 text-red-700 rounded-xl font-medium">{siteMsg}</div>}

      {editingId === null && (
        <div className="space-y-2">
          {sites.map(site => (
            <div key={site.id} className="p-3 rounded-xl border border-slate-200 bg-slate-50 flex items-start justify-between gap-2">
              <div className="min-w-0">
                <div className="font-bold text-slate-900">{site.name}</div>
                <div className="text-slate-600">{site.address}</div>
                <div className="text-[11px] text-slate-500">Contact: {site.contactName} ({site.contactPhone})</div>
              </div>
              <button type="button" onClick={() => openForm(site)} className="shrink-0 px-2.5 py-1 rounded-lg border border-slate-300 text-slate-700 font-bold hover:bg-white cursor-pointer flex items-center gap-1">
                <Edit3 className="w-3.5 h-3.5" /> Edit
              </button>
            </div>
          ))}
          {sites.length === 0 && <p className="text-slate-500">No sites yet.</p>}
        </div>
      )}

      {editingId !== null && (
        <form onSubmit={saveSite} className="space-y-3 p-3 rounded-xl border border-blue-200 bg-blue-50/40">
          <div className="font-bold text-slate-900">{editingId === 'new' ? 'Add a new site' : 'Edit site'}</div>
          {field('name', 'Site Name', true)}
          {field('address', 'Street Address (Adelaide, SA)', true)}
          <div className="grid grid-cols-2 gap-3">
            {field('contactName', 'Site Contact')}
            {field('contactPhone', 'Contact Phone')}
          </div>
          {field('accessInstructions', 'Access Instructions')}
          {field('securityNotes', 'Security / Hazard Notes')}
          <div className="flex justify-end gap-2">
            <button type="button" onClick={() => setEditingId(null)} className="px-4 py-2 rounded-xl border border-slate-300 font-bold text-slate-600 hover:bg-slate-50 cursor-pointer">Cancel</button>
            <button type="submit" disabled={busy} className="px-5 py-2 rounded-xl bg-[#0286cd] hover:bg-[#026fa8] text-white font-extrabold cursor-pointer">
              {busy ? 'Saving...' : 'Save Site'}
            </button>
          </div>
        </form>
      )}
    </div>
  );
}

/* =========================================================================
   MODAL: CANCEL SUBSCRIPTION
   ========================================================================= */
function CancelSubscriptionModal({ account, onClose, onCancelSuccess }) {
  const [confirmed, setConfirmed] = useState(false);
  const [cancelling, setCancelling] = useState(false);

  const handleCancel = async () => {
    setCancelling(true);
    try {
      const res = await fetch(`${API_BASE}/customers/${account.id}/cancel-subscription`, { method: 'POST' });
      const data = await res.json();
      setCancelling(false);
      onCancelSuccess(data.customer || { ...account, subscriptionStatus: 'CANCELLED' });
    } catch (e) {
      setCancelling(false);
      onCancelSuccess({ ...account, subscriptionStatus: 'CANCELLED' });
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-4">
      <div className="bg-white max-w-md w-full p-6 rounded-3xl space-y-4 border border-red-200 shadow-2xl text-xs text-slate-800">
        <div className="flex items-center justify-between border-b border-slate-200 pb-3 text-red-600">
          <h3 className="text-lg font-bold flex items-center gap-2">
            <AlertTriangle className="w-5 h-5 text-red-600" />
            Cancel Membership Subscription
          </h3>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-700 cursor-pointer"><X className="w-5 h-5" /></button>
        </div>

        <p className="text-slate-600 leading-relaxed font-medium">
          Are you sure you want to cancel the Emergency Cleaning Membership for <strong>{account.businessName}</strong>?
        </p>

        <div className="bg-red-50 border border-red-200 p-3 rounded-xl text-red-800 text-[11px] space-y-1">
          <p className="font-bold">Important Notice:</p>
          <ul className="list-disc list-inside space-y-0.5">
            <li>Your 2–4 Hour SLA priority attendance will be deactivated.</li>
            <li>Unredeemed Reward Points balance will be frozen.</li>
          </ul>
        </div>

        <label className="flex items-start gap-2 bg-slate-50 p-3 rounded-xl border border-slate-200 cursor-pointer">
          <input type="checkbox" checked={confirmed} onChange={e => setConfirmed(e.target.checked)} className="mt-0.5 text-red-600 rounded" />
          <span className="font-bold text-slate-800 text-[11px]">I confirm that I wish to cancel this membership subscription.</span>
        </label>

        <div className="pt-2 flex justify-between">
          <button type="button" onClick={onClose} className="px-4 py-2 rounded-xl border border-slate-300 font-bold text-slate-600 hover:bg-slate-50 cursor-pointer">Keep Membership</button>
          <button type="button" disabled={!confirmed || cancelling} onClick={handleCancel} className={`px-5 py-2 rounded-xl font-bold cursor-pointer ${confirmed ? 'bg-red-600 hover:bg-red-700 text-white shadow-md' : 'bg-slate-200 text-slate-400 cursor-not-allowed'}`}>
            {cancelling ? 'Cancelling...' : 'Confirm Cancellation'}
          </button>
        </div>
      </div>
    </div>
  );
}

/* =========================================================================
   MODAL: ADD NEW TECHNICIAN (WITH PROFILE PHOTO UPLOAD)
   ========================================================================= */
function AddTechnicianModal({ onClose, onAdd }) {
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [status, setStatus] = useState('AVAILABLE');
  const [avatar, setAvatar] = useState('https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=150&q=80');

  const handlePhotoUpload = (e) => {
    const file = e.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setAvatar(reader.result);
      };
      reader.readAsDataURL(file);
    }
  };

  const [techFormError, setTechFormError] = useState('');

  const handleSubmit = (e) => {
    e.preventDefault();
    setTechFormError('');

    if (!name || name.trim().length < 2) {
      setTechFormError('Validation Error: Technician full name is required (at least 2 characters).');
      return;
    }
    const cleanPhone = phone.replace(/[\s\-\(\)\+]/g, '');
    if (!cleanPhone || !/^\d{8,12}$/.test(cleanPhone)) {
      setTechFormError('Validation Error: Please enter a valid phone number (8 to 12 digits).');
      return;
    }

    onAdd({
      id: `tech-${Date.now()}`,
      name,
      phone,
      status,
      avatar,
      rating: 5.0
    });
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-white max-w-md w-full p-6 rounded-3xl space-y-4 border border-slate-200 shadow-2xl text-xs text-slate-800">
        <div className="flex items-center justify-between border-b border-slate-200 pb-3">
          <h3 className="text-lg font-bold text-slate-900 flex items-center gap-2">
            <Wrench className="w-5 h-5 text-[#0286cd]" />
            Add New Technician to Roster
          </h3>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-700 cursor-pointer"><X className="w-5 h-5" /></button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {techFormError && (
            <div className="bg-red-50 border-l-4 border-l-red-600 p-3.5 rounded-2xl text-red-900 font-extrabold text-xs flex items-center gap-2 shadow-sm border border-red-200">
              <AlertCircle className="w-4 h-4 text-red-600 shrink-0" />
              <span>{techFormError}</span>
            </div>
          )}
          {/* Profile Photo Uploader & Live Preview */}
          <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200 space-y-3">
            <label className="block text-slate-800 font-bold text-xs">Technician Profile Photo</label>

            <div className="flex items-center gap-4">
              <img
                src={avatar}
                alt="Profile Preview"
                className="w-16 h-16 rounded-2xl object-cover border border-slate-300 shadow-md shrink-0"
              />

              <div className="space-y-2 flex-1">
                <label className="bg-[#0286cd] hover:bg-[#026fa8] text-white font-bold px-3 py-2 rounded-xl text-xs cursor-pointer inline-flex items-center gap-1.5 shadow transition-all">
                  <UploadCloud className="w-4 h-4" />
                  <span>Choose Photo File</span>
                  <input type="file" accept="image/*" onChange={handlePhotoUpload} className="hidden" />
                </label>

                <input
                  type="text"
                  value={avatar}
                  onChange={e => setAvatar(e.target.value)}
                  placeholder="Or paste photo URL..."
                  className="w-full bg-white border border-slate-300 rounded-xl p-2 text-[11px] font-medium text-slate-800"
                />
              </div>
            </div>
          </div>

          <div>
            <label className="block text-slate-700 font-bold mb-1">Technician Full Name</label>
            <input required type="text" value={name} onChange={e => setName(e.target.value)} placeholder="e.g. Jason Blake" className="w-full bg-slate-50 border border-slate-300 rounded-xl p-2.5 text-slate-900 font-bold" />
          </div>

          <div>
            <label className="block text-slate-700 font-bold mb-1">Mobile Phone Number</label>
            <input required type="text" value={phone} onChange={e => setPhone(e.target.value)} placeholder="0499 111 222" className="w-full bg-slate-50 border border-slate-300 rounded-xl p-2.5 text-slate-900 font-bold" />
          </div>

          <div>
            <label className="block text-slate-700 font-bold mb-1">Initial Status</label>
            <select value={status} onChange={e => setStatus(e.target.value)} className="w-full bg-slate-50 border border-slate-300 rounded-xl p-2.5 text-slate-900 font-bold">
              <option value="AVAILABLE">AVAILABLE (On Call)</option>
              <option value="ON_SITE">ON_SITE (Assigned)</option>
            </select>
          </div>

          <div className="pt-2 flex gap-3">
            <button type="button" onClick={onClose} className="flex-1 bg-slate-200 hover:bg-slate-300 text-slate-800 font-bold py-3 rounded-xl cursor-pointer">
              Cancel
            </button>
            <button type="submit" className="flex-1 bg-[#0286cd] hover:bg-[#026fa8] text-white font-extrabold py-3 rounded-xl shadow-md transition-all cursor-pointer">
              ADD TECHNICIAN TO FLEET
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

/* =========================================================================
   MODAL: DISPATCH & ASSIGN TECHNICIAN
   ========================================================================= */
function AssignDispatchModal({ job, technicians, onClose, onAssign }) {
  const [selectedTech, setSelectedTech] = useState(job?.technicianName || technicians[0]?.name || 'Dave Miller');
  const [status, setStatus] = useState(job?.status && job?.status !== 'NEW' && job?.status !== 'SUBMITTED' ? job.status : 'TECH_ASSIGNED');

  const handleSubmit = (e) => {
    e.preventDefault();
    onAssign(selectedTech, status);
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-white max-w-lg w-full p-6 rounded-3xl space-y-4 border border-slate-200 shadow-2xl text-xs text-slate-800 max-h-[90vh] overflow-y-auto custom-scroll-container">
        <div className="flex items-center justify-between border-b border-slate-200 pb-3">
          <h3 className="text-lg font-black text-slate-900 flex items-center gap-2">
            <ShieldAlert className="w-5 h-5 text-[#0286cd]" />
            Dispatch Job {job.jobNumber || job.id}
          </h3>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-700 cursor-pointer"><X className="w-5 h-5" /></button>
        </div>

        {/* Job Summary Banner */}
        <div className="bg-blue-50/70 p-3.5 rounded-2xl border border-blue-200 space-y-1 text-blue-950">
          <div className="font-extrabold text-sm text-[#0286cd]">{job.customerName} • {job.category} Emergency</div>
          <div className="text-xs font-semibold text-slate-700">📍 Location: {job.locationName} ({job.address})</div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-slate-900 font-extrabold text-xs mb-2 uppercase tracking-wider">
              Select Field Technician (Real-Time Roster Status):
            </label>

            <div className="space-y-2.5 max-h-60 overflow-y-auto pr-1 custom-scroll-container">
              {technicians.map(t => {
                const isSelected = selectedTech === t.name;
                const isOnSite = t.status === 'ON_SITE';
                const isAvailable = t.status === 'AVAILABLE';

                return (
                  <div
                    key={t.id}
                    onClick={() => setSelectedTech(t.name)}
                    className={`p-3.5 rounded-2xl border-2 cursor-pointer transition-all flex items-center justify-between gap-3 ${
                      isSelected 
                        ? 'border-[#0286cd] bg-blue-50/80 shadow-md ring-2 ring-[#0286cd]/20' 
                        : 'border-slate-200 bg-slate-50 hover:border-slate-300'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <img
                        src={t.avatar || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=150&q=80'}
                        alt={t.name}
                        className="w-11 h-11 rounded-2xl object-cover border border-slate-300 shadow-sm shrink-0"
                      />
                      <div>
                        <div className="font-extrabold text-slate-900 text-xs flex items-center gap-1.5">
                          {t.name}
                          {isSelected && <CheckCircle2 className="w-4 h-4 text-[#0286cd]" />}
                        </div>
                        <div className="text-[11px] text-slate-600 font-medium">📞 {t.phone} • ⭐ {t.rating || 5.0}</div>
                      </div>
                    </div>

                    {/* Real-Time Status Badge */}
                    <div>
                      {isOnSite ? (
                        <span className="bg-amber-100 text-amber-900 border border-amber-300 font-black px-2.5 py-1 rounded-xl text-[10px] uppercase tracking-wider flex items-center gap-1 shadow-sm">
                          <span className="w-2 h-2 rounded-full bg-amber-500 animate-ping"></span>
                          📍 ON SITE
                        </span>
                      ) : isAvailable ? (
                        <span className="bg-emerald-100 text-emerald-900 border border-emerald-300 font-black px-2.5 py-1 rounded-xl text-[10px] uppercase tracking-wider flex items-center gap-1 shadow-sm">
                          <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
                          🟢 AVAILABLE
                        </span>
                      ) : (
                        <span className="bg-slate-200 text-slate-700 border border-slate-300 font-bold px-2.5 py-1 rounded-xl text-[10px] uppercase tracking-wider">
                          ⚪ OFF DUTY
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <div>
            <label className="block text-slate-700 font-bold mb-1">Set Initial Dispatch Status</label>
            <select value={status} onChange={e => setStatus(e.target.value)} className="w-full bg-slate-50 border border-slate-300 rounded-xl p-2.5 text-slate-900 font-bold">
              <option value="TECH_ASSIGNED">TECH_ASSIGNED (Dispatched to Tech)</option>
              <option value="ACCEPTED">ACCEPTED (Accepted & En Route)</option>
              <option value="IN_PROGRESS">IN_PROGRESS (On-site Emergency Service)</option>
              <option value="MORE_INFO_REQUIRED">MORE_INFO_REQUIRED (Pause SLA Clock)</option>
            </select>
          </div>

          <div className="pt-2 flex gap-3">
            <button type="button" onClick={onClose} className="flex-1 bg-slate-200 hover:bg-slate-300 text-slate-800 font-bold py-3 rounded-xl cursor-pointer text-xs">
              Cancel
            </button>
            <button type="submit" className="flex-1 bg-[#0286cd] hover:bg-[#026fa8] text-white font-extrabold py-3 rounded-xl shadow-lg transition-all text-xs cursor-pointer flex items-center justify-center gap-1.5">
              <CheckCircle2 className="w-4 h-4 text-white" /> CONFIRM DISPATCH & ASSIGNMENT
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

/* =========================================================================
   HOTLINE BOOKING MODAL
   ========================================================================= */
function HotlineBookingModal({ account, customerAccounts = [], config, onClose, onSubmit }) {
  const [selectedOrgId, setSelectedOrgId] = useState(account?.id || (customerAccounts[0]?.id || ''));
  const selectedOrg = customerAccounts.find(c => c.id === selectedOrgId) || account;
  const [callerName, setCallerName] = useState(account?.primaryContactName || '');
  const [callerPhone, setCallerPhone] = useState(account?.phoneNumber || '');
  const [category, setCategory] = useState('Toilet overflow');
  const [address, setAddress] = useState(selectedOrg?.locations?.[0]?.address || 'Adelaide CBD SA 5000');
  const [description, setDescription] = useState('');

  const [hotlineError, setHotlineError] = useState('');

  const handleOrgChange = (newOrgId) => {
    setSelectedOrgId(newOrgId);
    const org = customerAccounts.find(c => c.id === newOrgId);
    if (org) {
      setCallerName(org.primaryContactName || '');
      setCallerPhone(org.phoneNumber || '');
      if (org.locations && org.locations.length > 0) {
        setAddress(org.locations[0].address);
      }
    }
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    setHotlineError('');

    if (!callerName || callerName.trim().length < 2) {
      setHotlineError('Validation Error: Caller name is required (at least 2 characters).');
      return;
    }
    const cleanPhone = callerPhone.replace(/[\s\-\(\)\+]/g, '');
    if (!cleanPhone || !/^\d{8,12}$/.test(cleanPhone)) {
      setHotlineError('Validation Error: Please enter a valid phone number (8 to 12 digits).');
      return;
    }
    if (!address || address.trim().length < 3) {
      setHotlineError('Validation Error: Site address is required (at least 3 characters).');
      return;
    }
    if (!description || description.trim().length < 5) {
      setHotlineError('Validation Error: Please enter incident details (at least 5 characters).');
      return;
    }

    const locId = selectedOrg?.locations?.[0]?.id || null;

    onSubmit({
      organizationId: selectedOrgId || selectedOrg?.id,
      locationId: locId,
      customerName: selectedOrg?.businessName || 'Hotline Phone Caller',
      locationName: selectedOrg?.locations?.[0]?.name || 'Hotline Site Request',
      address: address || 'Adelaide CBD SA 5000',
      category,
      description: `[HOTLINE ORDER] Caller: ${callerName} (${callerPhone}) • ${description}`,
      onsiteContact: callerName,
      onsitePhone: callerPhone,
      accessInstructions: 'Operator recorded phone request',
      photos: ['https://images.unsplash.com/photo-1584622650111-993a426fbf0a?auto=format&fit=crop&w=600&q=80']
    });
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-white max-w-lg w-full p-6 rounded-3xl space-y-4 border border-slate-200 shadow-2xl text-xs text-slate-800">
        <div className="flex items-center justify-between border-b border-slate-200 pb-3">
          <h3 className="text-lg font-bold text-slate-900 flex items-center gap-2">
            <PhoneCall className="w-5 h-5 text-red-600" />
            24/7 Hotline Phone Order Entry
          </h3>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-700 cursor-pointer"><X className="w-5 h-5" /></button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-3">
          {hotlineError && (
            <div className="bg-red-50 border-l-4 border-l-red-600 p-3.5 rounded-2xl text-red-900 font-extrabold text-xs flex items-center gap-2 shadow-sm border border-red-200">
              <AlertCircle className="w-4 h-4 text-red-600 shrink-0" />
              <span>{hotlineError}</span>
            </div>
          )}
          {customerAccounts && customerAccounts.length > 0 && (
            <div>
              <label className="block text-slate-700 font-bold mb-1">Select Customer Business</label>
              <select
                value={selectedOrgId}
                onChange={e => handleOrgChange(e.target.value)}
                className="w-full bg-slate-50 border border-slate-300 rounded-xl p-2.5 text-slate-900 font-medium"
              >
                {customerAccounts.map(c => (
                  <option key={c.id} value={c.id}>
                    {c.businessName} ({c.membershipPlan.toUpperCase()} - {c.calloutsUsed || 0} callouts used)
                  </option>
                ))}
              </select>
            </div>
          )}

          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="block text-slate-700 font-bold mb-1">Caller Name</label>
              <input required type="text" value={callerName} onChange={e => setCallerName(e.target.value)} placeholder="Caller Name..." className="w-full bg-slate-50 border border-slate-300 rounded-xl p-2.5 text-slate-900 font-medium" />
            </div>
            <div>
              <label className="block text-slate-700 font-bold mb-1">Phone Number</label>
              <input required type="text" value={callerPhone} onChange={e => setCallerPhone(e.target.value)} placeholder="0400 000 000" className="w-full bg-slate-50 border border-slate-300 rounded-xl p-2.5 text-slate-900 font-medium" />
            </div>
          </div>

          <div>
            <label className="block text-slate-700 font-bold mb-1">Incident Category</label>
            <select value={category} onChange={e => setCategory(e.target.value)} className="w-full bg-slate-50 border border-slate-300 rounded-xl p-2.5 text-slate-900 font-medium">
              {(config?.incidentCategories || []).map(cat => (
                <option key={cat} value={cat}>{cat}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-slate-700 font-bold mb-1">Site Address</label>
            <input required type="text" value={address} onChange={e => setAddress(e.target.value)} placeholder="Site address..." className="w-full bg-slate-50 border border-slate-300 rounded-xl p-2.5 text-slate-900 font-medium" />
          </div>

          <div>
            <label className="block text-slate-700 font-bold mb-1">Description</label>
            <textarea required rows={2} value={description} onChange={e => setDescription(e.target.value)} placeholder="Details from phone conversation..." className="w-full bg-slate-50 border border-slate-300 rounded-xl p-2.5 text-slate-900 font-medium" />
          </div>

          <button type="submit" className="w-full bg-red-600 hover:bg-red-500 text-white font-extrabold py-3 rounded-xl shadow-md transition-all cursor-pointer">
            DISPATCH EMERGENCY HOTLINE REQUEST
          </button>
        </form>
      </div>
    </div>
  );
}

/* =========================================================================
   POINTS REDEMPTION MODAL
   ========================================================================= */
function PointsRedemptionModal({ account, config, onClose }) {
  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-white max-w-lg w-full p-6 rounded-3xl space-y-4 border border-slate-200 shadow-2xl text-xs text-slate-800">
        <div className="flex items-center justify-between border-b border-slate-200 pb-3">
          <h3 className="text-lg font-bold text-slate-900 flex items-center gap-2">
            <Award className="w-5 h-5 text-purple-700" />
            Reward Points Catalog & Redemption Form
          </h3>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-700 cursor-pointer"><X className="w-5 h-5" /></button>
        </div>

        <div className="space-y-2">
          <p className="text-slate-700 font-medium">Your Current Balance: <span className="font-bold text-purple-700">{account.pointsBalance} pts</span></p>
          <div className="space-y-2 pt-2">
            {(config.redemptionRates || []).slice(0, 5).map(rate => (
              <div key={rate.code} className="flex justify-between items-center p-3 bg-slate-50 rounded-xl border border-slate-200">
                <span className="text-slate-800 font-bold">{rate.name}</span>
                <span className="text-purple-700 font-bold">{rate.points} pts / {rate.unit}</span>
              </div>
            ))}
          </div>
        </div>

        <button onClick={onClose} className="w-full bg-purple-700 hover:bg-purple-800 text-white font-bold py-2.5 rounded-xl text-xs cursor-pointer shadow">
          Close Catalog
        </button>
      </div>
    </div>
  );
}

/* =========================================================================
   NEW EMERGENCY REQUEST MODAL
   ========================================================================= */
/* =========================================================================
   NEW EMERGENCY REQUEST MODAL COMPONENT
   ========================================================================= */
function NewEmergencyRequestModal({ account, config, onClose, onSubmit }) {
  const [selectedLocId, setSelectedLocId] = useState(account.locations?.[0]?.id || 'loc-1');
  const [category, setCategory] = useState('Toilet overflow');
  const [description, setDescription] = useState('');
  const [affectedArea, setAffectedArea] = useState('25');
  const [incidentTime, setIncidentTime] = useState(new Date().toISOString().slice(0, 16));
  const [isOngoing, setIsOngoing] = useState(false);
  const [isSafeToAccess, setIsSafeToAccess] = useState(true);
  const [onsiteContact, setOnsiteContact] = useState(account.primaryContactName || account.primaryContact || 'Mahima Sharma');
  const [onsitePhone, setOnsitePhone] = useState(account.phoneNumber || account.phone || '0412 345 678');
  const [accessInstructions, setAccessInstructions] = useState(account.locations?.[0]?.accessInstructions || 'Keypad Code #4829 on Rear Service Door');
  const [accessRestrictions, setAccessRestrictions] = useState('Requires Hi-Vis vest & safety footwear after 6 PM');
  const [parkingInstructions, setParkingInstructions] = useState('Loading Dock Bay 3 or Visitor Bay near main entrance');
  
  // Media Uploads
  const [photoUrls, setPhotoUrls] = useState([
    'https://images.unsplash.com/photo-1584622650111-993a426fbf0a?auto=format&fit=crop&w=600&q=80',
    'https://images.unsplash.com/photo-1527515637462-cff94eecc1ac?auto=format&fit=crop&w=600&q=80'
  ]);
  const [videoUrls, setVideoUrls] = useState([]);
  const [newPhotoInput, setNewPhotoInput] = useState('');
  const [newVideoInput, setNewVideoInput] = useState('');

  // Handle Location Change to sync default access instructions
  const handleLocationChange = (locId) => {
    setSelectedLocId(locId);
    const loc = (account.locations || []).find(l => l.id === locId);
    if (loc) {
      if (loc.accessInstructions) setAccessInstructions(loc.accessInstructions);
      if (loc.securityNotes) setParkingInstructions(loc.securityNotes);
    }
  };

  const handlePhotoFileUpload = (e) => {
    const files = Array.from(e.target.files || []);
    files.forEach(file => {
      const reader = new FileReader();
      reader.onload = (event) => {
        setPhotoUrls(prev => [...prev, event.target.result]);
      };
      reader.readAsDataURL(file);
    });
  };

  const handleVideoFileUpload = (e) => {
    const files = Array.from(e.target.files || []);
    files.forEach(file => {
      const reader = new FileReader();
      reader.onload = (event) => {
        setVideoUrls(prev => [...prev, event.target.result]);
      };
      reader.readAsDataURL(file);
    });
  };

  const addPhotoUrl = (e) => {
    if (e) e.preventDefault();
    if (newPhotoInput.trim()) {
      setPhotoUrls(prev => [...prev, newPhotoInput.trim()]);
      setNewPhotoInput('');
    }
  };

  const removePhoto = (index) => {
    setPhotoUrls(photoUrls.filter((_, i) => i !== index));
  };

  const addVideoUrl = (e) => {
    if (e) e.preventDefault();
    if (newVideoInput.trim()) {
      setVideoUrls(prev => [...prev, newVideoInput.trim()]);
      setNewVideoInput('');
    }
  };

  const removeVideo = (index) => {
    setVideoUrls(videoUrls.filter((_, i) => i !== index));
  };

  const addSamplePhoto = (e) => {
    if (e) e.preventDefault();
    const samples = [
      'https://images.unsplash.com/photo-1584622650111-993a426fbf0a?auto=format&fit=crop&w=600&q=80',
      'https://images.unsplash.com/photo-1527515637462-cff94eecc1ac?auto=format&fit=crop&w=600&q=80',
      'https://images.unsplash.com/photo-1563453392212-326f5e854473?auto=format&fit=crop&w=600&q=80'
    ];
    const pick = samples[photoUrls.length % samples.length];
    setPhotoUrls(prev => [...prev, pick]);
  };

  const addSampleVideo = (e) => {
    if (e) e.preventDefault();
    const sampleVideo = 'https://assets.mixkit.co/videos/preview/mixkit-water-leaking-from-a-ceiling-pipe-42861-large.mp4';
    setVideoUrls(prev => [...prev, sampleVideo]);
  };

  const [calloutFormError, setCalloutFormError] = useState('');

  const handleSubmit = (e) => {
    e.preventDefault();
    setCalloutFormError('');

    if (!description || description.trim().length < 5) {
      setCalloutFormError('Validation Error: Please provide a detailed description of the incident (at least 5 characters).');
      return;
    }
    if (isNaN(Number(affectedArea)) || Number(affectedArea) <= 0) {
      setCalloutFormError('Validation Error: Please enter a valid positive number for affected area (m²).');
      return;
    }
    if (!onsiteContact || onsiteContact.trim().length < 2) {
      setCalloutFormError('Validation Error: Onsite contact person name is required (at least 2 characters).');
      return;
    }
    const cleanPhone = onsitePhone.replace(/[\s\-\(\)\+]/g, '');
    if (!cleanPhone || !/^\d{8,12}$/.test(cleanPhone)) {
      setCalloutFormError('Validation Error: Please enter a valid Australian phone number (8 to 12 digits).');
      return;
    }

    const loc = (account.locations || []).find(l => l.id === selectedLocId) || account.locations?.[0] || {};
    
    // Auto-commit any text typed into input boxes
    let finalPhotos = [...photoUrls];
    if (newPhotoInput.trim() && !finalPhotos.includes(newPhotoInput.trim())) {
      finalPhotos.push(newPhotoInput.trim());
    }

    let finalVideos = [...videoUrls];
    if (newVideoInput.trim() && !finalVideos.includes(newVideoInput.trim())) {
      finalVideos.push(newVideoInput.trim());
    }

    onSubmit({
      organizationId: account.id,
      locationId: loc.id || 'loc-1',
      customerName: account.businessName,
      locationName: loc.name || 'Adelaide CBD Headquarters',
      address: loc.address || '120 Grenfell Street, Adelaide SA 5000',
      category,
      description,
      affectedArea: parseFloat(affectedArea) || 0,
      incidentTime,
      isOngoing,
      isSafeToAccess,
      onsiteContact,
      onsitePhone,
      accessInstructions,
      accessRestrictions,
      parkingInstructions,
      photos: finalPhotos,
      videos: finalVideos
    });
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/70 backdrop-blur-md flex items-center justify-center p-4">
      <div className="bg-white max-w-2xl w-full p-6 rounded-3xl space-y-5 border border-slate-200 shadow-2xl text-xs text-slate-800 max-h-[90vh] overflow-y-auto custom-scroll-container">
        <div className="flex items-center justify-between border-b border-slate-200 pb-3 sticky top-0 bg-white z-10">
          <div>
            <h3 className="text-lg font-black text-slate-900 flex items-center gap-2">
              <ShieldAlert className="w-5 h-5 text-[#0286cd]" />
              Request Emergency Cleaning Dispatch
            </h3>
            <p className="text-xs text-slate-600">Complete all required incident, site access & contact details</p>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-700 cursor-pointer p-1 rounded-lg hover:bg-slate-100"><X className="w-5 h-5" /></button>
        </div>

        {/* Mandatory On-site Staff Representative Presence Disclaimer */}
        <div className="bg-amber-50 border-l-4 border-l-amber-500 border border-amber-200 p-3.5 rounded-2xl text-amber-900 space-y-1">
          <div className="font-extrabold flex items-center gap-2 text-xs text-amber-800 uppercase tracking-wider">
            <AlertTriangle className="w-4 h-4 text-amber-600" />
            Mandatory Representative Presence Required On-Site
          </div>
          <p className="text-[11px] text-slate-700 leading-relaxed">
            <strong>Advisory Notice:</strong> A staff member or authorized business representative MUST be present on-site when our SACC technician arrives, unless alternative access arrangements have been previously approved by management.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5 text-xs">
          {calloutFormError && (
            <div className="bg-red-50 border-l-4 border-l-red-600 p-3.5 rounded-2xl text-red-900 font-extrabold text-xs flex items-center gap-2 shadow-sm border border-red-200">
              <AlertCircle className="w-4 h-4 text-red-600 shrink-0" />
              <span>{calloutFormError}</span>
            </div>
          )}
          {/* SECTION 1: Service Location & Incident Type */}
          <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200 space-y-3">
            <h4 className="font-black text-slate-900 text-xs uppercase tracking-wider text-[#0286cd] flex items-center gap-1.5">
              <Building className="w-4 h-4" /> 1. Location & Incident Classification
            </h4>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div>
                <label className="block text-slate-700 mb-1 font-bold">1. Service Location <span className="text-red-500">*</span></label>
                <select
                  value={selectedLocId}
                  onChange={(e) => handleLocationChange(e.target.value)}
                  className="w-full bg-white border border-slate-300 rounded-xl p-2.5 text-slate-900 font-semibold"
                >
                  {(account.locations || []).map(l => (
                    <option key={l.id} value={l.id}>{l.name} ({l.address})</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-slate-700 mb-1 font-bold">2. Type of Incident <span className="text-red-500">*</span></label>
                <select
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                  className="w-full bg-white border border-slate-300 rounded-xl p-2.5 text-slate-900 font-semibold"
                >
                  {config.incidentCategories.map(cat => (
                    <option key={cat} value={cat}>{cat}</option>
                  ))}
                </select>
              </div>
            </div>

            {/* Toilet Overflow Policy Disclaimer Banner */}
            {category === 'Toilet overflow' && (
              <div className="bg-blue-50 border border-blue-200 p-3 rounded-xl text-blue-900 space-y-1">
                <div className="font-bold flex items-center gap-1 text-[11px] text-[#0286cd]">
                  <AlertCircle className="w-3.5 h-3.5" />
                  Toilet Overflow Scope Notice:
                </div>
                <p className="text-[10px] text-slate-700">{config.toiletOverflowDisclaimer}</p>
              </div>
            )}

            <div>
              <label className="block text-slate-700 mb-1 font-bold">3. Description of What Happened <span className="text-red-500">*</span></label>
              <textarea
                rows={2}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Provide detailed description of the incident, cause, and affected items..."
                className="w-full bg-white border border-slate-300 rounded-xl p-2.5 text-slate-900 font-medium"
                required
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div>
                <label className="block text-slate-700 mb-1 font-bold">4. Size of Affected Area (m²) <span className="text-red-500">*</span></label>
                <input
                  type="number"
                  min="1"
                  max="10000"
                  value={affectedArea}
                  onChange={(e) => setAffectedArea(e.target.value)}
                  placeholder="e.g. 25"
                  className="w-full bg-white border border-slate-300 rounded-xl p-2.5 text-slate-900 font-semibold"
                  required
                />
              </div>

              <div>
                <label className="block text-slate-700 mb-1 font-bold">5. When Incident Occurred <span className="text-red-500">*</span></label>
                <input
                  type="datetime-local"
                  value={incidentTime}
                  onChange={(e) => setIncidentTime(e.target.value)}
                  className="w-full bg-white border border-slate-300 rounded-xl p-2.5 text-slate-900 font-semibold"
                  required
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-1">
              <div>
                <label className="block text-slate-700 mb-1 font-bold">6. Is Incident Still Ongoing?</label>
                <div className="flex gap-4 items-center bg-white p-2.5 rounded-xl border border-slate-300">
                  <label className="flex items-center gap-1.5 font-semibold text-slate-800 cursor-pointer">
                    <input type="radio" name="isOngoing" checked={isOngoing} onChange={() => setIsOngoing(true)} className="text-[#0286cd]" />
                    <span>Yes (Active Flow/Leak)</span>
                  </label>
                  <label className="flex items-center gap-1.5 font-semibold text-slate-800 cursor-pointer">
                    <input type="radio" name="isOngoing" checked={!isOngoing} onChange={() => setIsOngoing(false)} className="text-[#0286cd]" />
                    <span>No (Stopped/Contained)</span>
                  </label>
                </div>
              </div>

              <div>
                <label className="block text-slate-700 mb-1 font-bold">7. Is Area Safe to Access?</label>
                <div className="flex gap-4 items-center bg-white p-2.5 rounded-xl border border-slate-300">
                  <label className="flex items-center gap-1.5 font-semibold text-slate-800 cursor-pointer">
                    <input type="radio" name="isSafe" checked={isSafeToAccess} onChange={() => setIsSafeToAccess(true)} className="text-[#0286cd]" />
                    <span>Yes (Safe for Tech)</span>
                  </label>
                  <label className="flex items-center gap-1.5 font-semibold text-slate-800 cursor-pointer">
                    <input type="radio" name="isSafe" checked={!isSafeToAccess} onChange={() => setIsSafeToAccess(false)} className="text-[#0286cd]" />
                    <span>No (Hazards Present)</span>
                  </label>
                </div>
              </div>
            </div>
          </div>

          {/* SECTION 2: Onsite Contact Person & Site Access Instructions */}
          <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200 space-y-3">
            <h4 className="font-black text-slate-900 text-xs uppercase tracking-wider text-[#0286cd] flex items-center gap-1.5">
              <User className="w-4 h-4" /> 2. On-Site Contact & Security Access Instructions
            </h4>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div>
                <label className="block text-slate-700 mb-1 font-bold">8. Onsite Contact Name <span className="text-red-500">*</span></label>
                <input
                  type="text"
                  value={onsiteContact}
                  onChange={(e) => setOnsiteContact(e.target.value)}
                  placeholder="Full name of person on site"
                  className="w-full bg-white border border-slate-300 rounded-xl p-2.5 text-slate-900 font-semibold"
                  required
                />
              </div>

              <div>
                <label className="block text-slate-700 mb-1 font-bold">9. Onsite Contact Phone Number <span className="text-red-500">*</span></label>
                <input
                  type="tel"
                  value={onsitePhone}
                  onChange={(e) => setOnsitePhone(e.target.value)}
                  placeholder="e.g. 0412 345 678"
                  className="w-full bg-white border border-slate-300 rounded-xl p-2.5 text-slate-900 font-semibold"
                  required
                />
              </div>
            </div>

            <div>
              <label className="block text-slate-700 mb-1 font-bold">10. Access Instructions <span className="text-red-500">*</span></label>
              <input
                type="text"
                value={accessInstructions}
                onChange={(e) => setAccessInstructions(e.target.value)}
                placeholder="Keypad code, lockbox location, gate entry procedures..."
                className="w-full bg-white border border-slate-300 rounded-xl p-2.5 text-slate-900 font-medium"
                required
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div>
                <label className="block text-slate-700 mb-1 font-bold">11. Access Restrictions</label>
                <input
                  type="text"
                  value={accessRestrictions}
                  onChange={(e) => setAccessRestrictions(e.target.value)}
                  placeholder="Height clearances, PPE requirements, security clearance..."
                  className="w-full bg-white border border-slate-300 rounded-xl p-2.5 text-slate-900 font-medium"
                />
              </div>

              <div>
                <label className="block text-slate-700 mb-1 font-bold">12. Parking or Security Instructions</label>
                <input
                  type="text"
                  value={parkingInstructions}
                  onChange={(e) => setParkingInstructions(e.target.value)}
                  placeholder="Loading bay, security desk check-in, visitor bays..."
                  className="w-full bg-white border border-slate-300 rounded-xl p-2.5 text-slate-900 font-medium"
                />
              </div>
            </div>
          </div>

          {/* SECTION 3: Multiple Incident Photos & Short Videos Upload */}
          <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200 space-y-4">
            <h4 className="font-black text-slate-900 text-xs uppercase tracking-wider text-[#0286cd] flex items-center gap-1.5">
              <Camera className="w-4 h-4" /> 3. Upload Incident Photos & Short Video Clips
            </h4>

            {/* Photos Upload */}
            <div className="space-y-3">
              <label className="block text-slate-800 font-bold">Photo Uploads (Image Files or URLs)</label>
              
              <div className="flex flex-wrap gap-2 items-center">
                {/* File Upload Button */}
                <label className="bg-[#0286cd] hover:bg-[#026fa8] text-white font-bold px-3.5 py-2 rounded-xl cursor-pointer text-xs flex items-center gap-1.5 shadow-sm">
                  <UploadCloud className="w-4 h-4" />
                  <span>Choose Image File(s)</span>
                  <input
                    type="file"
                    accept="image/*"
                    multiple
                    onChange={handlePhotoFileUpload}
                    className="hidden"
                  />
                </label>

                <button
                  type="button"
                  onClick={addSamplePhoto}
                  className="bg-blue-100 hover:bg-blue-200 text-[#0286cd] font-bold px-3 py-2 rounded-xl border border-blue-300 text-xs cursor-pointer"
                >
                  + Add Sample Photo
                </button>
              </div>

              {/* URL Input */}
              <div className="flex gap-2">
                <input
                  type="text"
                  value={newPhotoInput}
                  onChange={(e) => setNewPhotoInput(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter') addPhotoUrl(e); }}
                  placeholder="Or paste photo image URL link..."
                  className="flex-1 bg-white border border-slate-300 rounded-xl p-2.5 text-slate-900 font-medium"
                />
                <button
                  type="button"
                  onClick={addPhotoUrl}
                  className="bg-slate-800 hover:bg-slate-900 text-white font-bold px-4 py-2.5 rounded-xl cursor-pointer"
                >
                  + Add Link
                </button>
              </div>

              {photoUrls.length > 0 ? (
                <div className="flex gap-3 overflow-x-auto pt-1 pb-1">
                  {photoUrls.map((src, i) => (
                    <div key={i} className="relative group flex-shrink-0">
                      <img src={src} alt="Incident Photo" className="w-20 h-20 object-cover rounded-xl border border-slate-300 shadow-sm" />
                      <button
                        type="button"
                        onClick={() => removePhoto(i)}
                        className="absolute -top-1.5 -right-1.5 bg-red-600 text-white rounded-full p-1 shadow hover:bg-red-700 cursor-pointer"
                        title="Remove Photo"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-[11px] text-slate-500 italic">No incident photos added yet.</p>
              )}
            </div>

            {/* Short Videos Upload */}
            <div className="space-y-3 pt-3 border-t border-slate-200">
              <label className="block text-slate-800 font-bold">Video Uploads (Short Incident Video Clips)</label>
              
              <div className="flex flex-wrap gap-2 items-center">
                {/* Video File Upload Button */}
                <label className="bg-purple-700 hover:bg-purple-800 text-white font-bold px-3.5 py-2 rounded-xl cursor-pointer text-xs flex items-center gap-1.5 shadow-sm">
                  <UploadCloud className="w-4 h-4" />
                  <span>Choose Video File(s)</span>
                  <input
                    type="file"
                    accept="video/*"
                    multiple
                    onChange={handleVideoFileUpload}
                    className="hidden"
                  />
                </label>

                <button
                  type="button"
                  onClick={addSampleVideo}
                  className="bg-purple-100 hover:bg-purple-200 text-purple-800 font-bold px-3 py-2 rounded-xl border border-purple-300 text-xs cursor-pointer"
                >
                  + Add Sample Video
                </button>
              </div>

              {/* Video URL Input */}
              <div className="flex gap-2">
                <input
                  type="text"
                  value={newVideoInput}
                  onChange={(e) => setNewVideoInput(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter') addVideoUrl(e); }}
                  placeholder="Or paste video MP4 link..."
                  className="flex-1 bg-white border border-slate-300 rounded-xl p-2.5 text-slate-900 font-medium"
                />
                <button
                  type="button"
                  onClick={addVideoUrl}
                  className="bg-slate-800 hover:bg-slate-900 text-white font-bold px-4 py-2.5 rounded-xl cursor-pointer"
                >
                  + Add Link
                </button>
              </div>

              {videoUrls.length > 0 ? (
                <div className="flex gap-3 overflow-x-auto pt-1 pb-1">
                  {videoUrls.map((src, i) => (
                    <div key={i} className="relative bg-slate-900 p-2 rounded-xl text-white text-[10px] space-y-1 flex flex-col justify-between w-40 flex-shrink-0">
                      <div className="flex justify-between items-center">
                        <span className="font-bold truncate text-purple-300">📹 Video Clip #{i + 1}</span>
                        <button
                          type="button"
                          onClick={() => removeVideo(i)}
                          className="bg-red-600 text-white rounded-full p-0.5 shadow hover:bg-red-700 cursor-pointer"
                        >
                          <X className="w-3 h-3" />
                        </button>
                      </div>
                      <span className="text-slate-300 font-mono text-[9px] truncate">{src}</span>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-[11px] text-slate-500 italic">No incident video clips added yet.</p>
              )}
            </div>
          </div>

          <button
            type="submit"
            className="w-full bg-[#0286cd] hover:bg-[#026fa8] text-white font-black py-4 rounded-2xl text-xs sm:text-sm transition-all shadow-xl cursor-pointer border border-blue-400 flex items-center justify-center gap-2"
          >
            <PlusCircle className="w-5 h-5 text-white" />
            SUBMIT EMERGENCY CLEANING DISPATCH REQUEST
          </button>
        </form>
      </div>
    </div>
  );
}

/* =========================================================================
   EDIT EMERGENCY REQUEST MODAL COMPONENT (Allowed when status is SUBMITTED)
   ========================================================================= */
function EditEmergencyRequestModal({ job, account, config, onClose, onSave }) {
  const [selectedLocId, setSelectedLocId] = useState(job.locationId || account.locations?.[0]?.id || 'loc-1');
  const [category, setCategory] = useState(job.category || 'Toilet overflow');
  const [description, setDescription] = useState(job.description || '');
  const [affectedArea, setAffectedArea] = useState(job.affectedArea ? String(job.affectedArea) : '25');
  const [incidentTime, setIncidentTime] = useState(
    job.incidentTime 
      ? new Date(job.incidentTime).toISOString().slice(0, 16) 
      : new Date().toISOString().slice(0, 16)
  );
  const [isOngoing, setIsOngoing] = useState(job.isOngoing !== undefined ? job.isOngoing : false);
  const [isSafeToAccess, setIsSafeToAccess] = useState(job.isSafeToAccess !== undefined ? job.isSafeToAccess : true);
  const [onsiteContact, setOnsiteContact] = useState(job.onsiteContact || '');
  const [onsitePhone, setOnsitePhone] = useState(job.onsitePhone || '');
  const [accessInstructions, setAccessInstructions] = useState(job.accessInstructions || '');
  const [accessRestrictions, setAccessRestrictions] = useState(job.accessRestrictions || '');
  const [parkingInstructions, setParkingInstructions] = useState(job.parkingInstructions || '');
  
  // Media Uploads
  const initialPhotos = Array.isArray(job.photos) ? job.photos : JSON.parse(job.photosJson || '[]');
  const initialVideos = Array.isArray(job.videos) ? job.videos : JSON.parse(job.videosJson || '[]');
  const [photoUrls, setPhotoUrls] = useState(initialPhotos);
  const [videoUrls, setVideoUrls] = useState(initialVideos);
  const [newPhotoInput, setNewPhotoInput] = useState('');
  const [newVideoInput, setNewVideoInput] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  const handlePhotoFileUpload = (e) => {
    const files = Array.from(e.target.files || []);
    files.forEach(file => {
      const reader = new FileReader();
      reader.onload = (event) => {
        setPhotoUrls(prev => [...prev, event.target.result]);
      };
      reader.readAsDataURL(file);
    });
  };

  const handleVideoFileUpload = (e) => {
    const files = Array.from(e.target.files || []);
    files.forEach(file => {
      const reader = new FileReader();
      reader.onload = (event) => {
        setVideoUrls(prev => [...prev, event.target.result]);
      };
      reader.readAsDataURL(file);
    });
  };

  const addPhotoUrl = (e) => {
    if (e) e.preventDefault();
    if (newPhotoInput.trim()) {
      setPhotoUrls(prev => [...prev, newPhotoInput.trim()]);
      setNewPhotoInput('');
    }
  };

  const removePhoto = (index) => {
    setPhotoUrls(photoUrls.filter((_, i) => i !== index));
  };

  const addVideoUrl = (e) => {
    if (e) e.preventDefault();
    if (newVideoInput.trim()) {
      setVideoUrls(prev => [...prev, newVideoInput.trim()]);
      setNewVideoInput('');
    }
  };

  const removeVideo = (index) => {
    setVideoUrls(videoUrls.filter((_, i) => i !== index));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsSaving(true);
    const loc = (account.locations || []).find(l => l.id === selectedLocId) || account.locations?.[0] || {};

    let finalPhotos = [...photoUrls];
    if (newPhotoInput.trim() && !finalPhotos.includes(newPhotoInput.trim())) {
      finalPhotos.push(newPhotoInput.trim());
    }

    let finalVideos = [...videoUrls];
    if (newVideoInput.trim() && !finalVideos.includes(newVideoInput.trim())) {
      finalVideos.push(newVideoInput.trim());
    }

    await onSave({
      locationId: loc.id || job.locationId,
      locationName: loc.name || job.locationName,
      address: loc.address || job.address,
      category,
      description,
      affectedArea: parseFloat(affectedArea) || 0,
      incidentTime,
      isOngoing,
      isSafeToAccess,
      onsiteContact,
      onsitePhone,
      accessInstructions,
      accessRestrictions,
      parkingInstructions,
      photos: finalPhotos,
      videos: finalVideos
    });
    setIsSaving(false);
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/70 backdrop-blur-md flex items-center justify-center p-4">
      <div className="bg-white max-w-2xl w-full p-6 rounded-3xl space-y-5 border border-slate-200 shadow-2xl text-xs text-slate-800 max-h-[90vh] overflow-y-auto custom-scroll-container">
        <div className="flex items-center justify-between border-b border-slate-200 pb-3 sticky top-0 bg-white z-10">
          <div>
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-mono font-extrabold text-[#0286cd] bg-blue-50 px-2.5 py-0.5 rounded border border-blue-200">
                {job.jobNumber || job.id}
              </span>
              <span className="text-[10px] font-bold text-amber-800 bg-amber-100 px-2.5 py-0.5 rounded border border-amber-300">
                Status: SUBMITTED (Awaiting Acceptance)
              </span>
            </div>
            <h3 className="text-lg font-black text-slate-900 flex items-center gap-2 mt-1">
              <Edit3 className="w-5 h-5 text-amber-500" />
              Edit Unaccepted Emergency Request
            </h3>
            <p className="text-xs text-slate-600">Update incident details, site access, or media prior to admin acceptance</p>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-700 cursor-pointer p-1 rounded-lg hover:bg-slate-100"><X className="w-5 h-5" /></button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5 text-xs">
          {/* SECTION 1: Service Location & Incident Type */}
          <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200 space-y-3">
            <h4 className="font-black text-slate-900 text-xs uppercase tracking-wider text-[#0286cd] flex items-center gap-1.5">
              <Building className="w-4 h-4" /> 1. Location & Incident Details
            </h4>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div>
                <label className="block text-slate-700 mb-1 font-bold">1. Service Location <span className="text-red-500">*</span></label>
                <select
                  value={selectedLocId}
                  onChange={(e) => setSelectedLocId(e.target.value)}
                  className="w-full bg-white border border-slate-300 rounded-xl p-2.5 text-slate-900 font-semibold"
                >
                  {(account.locations || []).map(l => (
                    <option key={l.id} value={l.id}>{l.name} ({l.address})</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-slate-700 mb-1 font-bold">2. Type of Incident <span className="text-red-500">*</span></label>
                <select
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                  className="w-full bg-white border border-slate-300 rounded-xl p-2.5 text-slate-900 font-semibold"
                >
                  {config.incidentCategories.map(cat => (
                    <option key={cat} value={cat}>{cat}</option>
                  ))}
                </select>
              </div>
            </div>

            <div>
              <label className="block text-slate-700 mb-1 font-bold">3. Description of What Happened <span className="text-red-500">*</span></label>
              <textarea
                rows={2}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                className="w-full bg-white border border-slate-300 rounded-xl p-2.5 text-slate-900 font-medium"
                required
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div>
                <label className="block text-slate-700 mb-1 font-bold">4. Size of Affected Area (m²) <span className="text-red-500">*</span></label>
                <input
                  type="number"
                  min="1"
                  max="10000"
                  value={affectedArea}
                  onChange={(e) => setAffectedArea(e.target.value)}
                  className="w-full bg-white border border-slate-300 rounded-xl p-2.5 text-slate-900 font-semibold"
                  required
                />
              </div>

              <div>
                <label className="block text-slate-700 mb-1 font-bold">5. When Incident Occurred <span className="text-red-500">*</span></label>
                <input
                  type="datetime-local"
                  value={incidentTime}
                  onChange={(e) => setIncidentTime(e.target.value)}
                  className="w-full bg-white border border-slate-300 rounded-xl p-2.5 text-slate-900 font-semibold"
                  required
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-1">
              <div>
                <label className="block text-slate-700 mb-1 font-bold">6. Is Incident Still Ongoing?</label>
                <div className="flex gap-4 items-center bg-white p-2.5 rounded-xl border border-slate-300">
                  <label className="flex items-center gap-1.5 font-semibold text-slate-800 cursor-pointer">
                    <input type="radio" name="editIsOngoing" checked={isOngoing} onChange={() => setIsOngoing(true)} className="text-[#0286cd]" />
                    <span>Yes (Active Flow)</span>
                  </label>
                  <label className="flex items-center gap-1.5 font-semibold text-slate-800 cursor-pointer">
                    <input type="radio" name="editIsOngoing" checked={!isOngoing} onChange={() => setIsOngoing(false)} className="text-[#0286cd]" />
                    <span>No (Contained)</span>
                  </label>
                </div>
              </div>

              <div>
                <label className="block text-slate-700 mb-1 font-bold">7. Is Area Safe to Access?</label>
                <div className="flex gap-4 items-center bg-white p-2.5 rounded-xl border border-slate-300">
                  <label className="flex items-center gap-1.5 font-semibold text-slate-800 cursor-pointer">
                    <input type="radio" name="editIsSafe" checked={isSafeToAccess} onChange={() => setIsSafeToAccess(true)} className="text-[#0286cd]" />
                    <span>Yes (Safe)</span>
                  </label>
                  <label className="flex items-center gap-1.5 font-semibold text-slate-800 cursor-pointer">
                    <input type="radio" name="editIsSafe" checked={!isSafeToAccess} onChange={() => setIsSafeToAccess(false)} className="text-[#0286cd]" />
                    <span>No (Hazards)</span>
                  </label>
                </div>
              </div>
            </div>
          </div>

          {/* SECTION 2: Onsite Contact & Security Instructions */}
          <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200 space-y-3">
            <h4 className="font-black text-slate-900 text-xs uppercase tracking-wider text-[#0286cd] flex items-center gap-1.5">
              <User className="w-4 h-4" /> 2. On-Site Contact & Security Access
            </h4>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div>
                <label className="block text-slate-700 mb-1 font-bold">8. Onsite Contact Name <span className="text-red-500">*</span></label>
                <input
                  type="text"
                  value={onsiteContact}
                  onChange={(e) => setOnsiteContact(e.target.value)}
                  className="w-full bg-white border border-slate-300 rounded-xl p-2.5 text-slate-900 font-semibold"
                  required
                />
              </div>

              <div>
                <label className="block text-slate-700 mb-1 font-bold">9. Onsite Contact Phone Number <span className="text-red-500">*</span></label>
                <input
                  type="tel"
                  value={onsitePhone}
                  onChange={(e) => setOnsitePhone(e.target.value)}
                  className="w-full bg-white border border-slate-300 rounded-xl p-2.5 text-slate-900 font-semibold"
                  required
                />
              </div>
            </div>

            <div>
              <label className="block text-slate-700 mb-1 font-bold">10. Access Instructions <span className="text-red-500">*</span></label>
              <input
                type="text"
                value={accessInstructions}
                onChange={(e) => setAccessInstructions(e.target.value)}
                className="w-full bg-white border border-slate-300 rounded-xl p-2.5 text-slate-900 font-medium"
                required
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div>
                <label className="block text-slate-700 mb-1 font-bold">11. Access Restrictions</label>
                <input
                  type="text"
                  value={accessRestrictions}
                  onChange={(e) => setAccessRestrictions(e.target.value)}
                  className="w-full bg-white border border-slate-300 rounded-xl p-2.5 text-slate-900 font-medium"
                />
              </div>

              <div>
                <label className="block text-slate-700 mb-1 font-bold">12. Parking / Security</label>
                <input
                  type="text"
                  value={parkingInstructions}
                  onChange={(e) => setParkingInstructions(e.target.value)}
                  className="w-full bg-white border border-slate-300 rounded-xl p-2.5 text-slate-900 font-medium"
                />
              </div>
            </div>
          </div>

          {/* SECTION 3: Photos & Videos */}
          <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200 space-y-4">
            <h4 className="font-black text-slate-900 text-xs uppercase tracking-wider text-[#0286cd] flex items-center gap-1.5">
              <Camera className="w-4 h-4" /> 3. Incident Photos & Videos
            </h4>

            {/* Photo List & Add */}
            <div className="space-y-2">
              <label className="block text-slate-800 font-bold">Photos ({photoUrls.length})</label>
              <div className="flex gap-2">
                <label className="bg-[#0286cd] text-white font-bold px-3 py-2 rounded-xl cursor-pointer text-xs flex items-center gap-1">
                  <UploadCloud className="w-4 h-4" /> Add File(s)
                  <input type="file" accept="image/*" multiple onChange={handlePhotoFileUpload} className="hidden" />
                </label>
                <input
                  type="text"
                  value={newPhotoInput}
                  onChange={(e) => setNewPhotoInput(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter') addPhotoUrl(e); }}
                  placeholder="Or paste photo URL..."
                  className="flex-1 bg-white border border-slate-300 rounded-xl p-2 text-slate-900"
                />
                <button type="button" onClick={addPhotoUrl} className="bg-slate-800 text-white font-bold px-3 py-2 rounded-xl">+ Link</button>
              </div>

              <div className="flex gap-3 overflow-x-auto pt-1">
                {photoUrls.map((src, i) => (
                  <div key={i} className="relative group flex-shrink-0">
                    <img src={src} alt="Incident" className="w-16 h-16 object-cover rounded-xl border border-slate-300 shadow-sm" />
                    <button type="button" onClick={() => removePhoto(i)} className="absolute -top-1.5 -right-1.5 bg-red-600 text-white rounded-full p-0.5"><X className="w-3 h-3" /></button>
                  </div>
                ))}
              </div>
            </div>

            {/* Video List & Add */}
            <div className="space-y-2 pt-2 border-t border-slate-200">
              <label className="block text-slate-800 font-bold">Video Clips ({videoUrls.length})</label>
              <div className="flex gap-2">
                <label className="bg-purple-700 text-white font-bold px-3 py-2 rounded-xl cursor-pointer text-xs flex items-center gap-1">
                  <UploadCloud className="w-4 h-4" /> Add Video File(s)
                  <input type="file" accept="video/*" multiple onChange={handleVideoFileUpload} className="hidden" />
                </label>
                <input
                  type="text"
                  value={newVideoInput}
                  onChange={(e) => setNewVideoInput(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter') addVideoUrl(e); }}
                  placeholder="Or paste video MP4 link..."
                  className="flex-1 bg-white border border-slate-300 rounded-xl p-2 text-slate-900"
                />
                <button type="button" onClick={addVideoUrl} className="bg-slate-800 text-white font-bold px-3 py-2 rounded-xl">+ Link</button>
              </div>

              <div className="flex gap-3 overflow-x-auto pt-1">
                {videoUrls.map((src, i) => (
                  <div key={i} className="relative bg-slate-900 p-2 rounded-xl text-white text-[10px] flex items-center justify-between w-36 flex-shrink-0">
                    <span className="truncate text-purple-300 font-bold">📹 Clip #{i + 1}</span>
                    <button type="button" onClick={() => removeVideo(i)} className="bg-red-600 text-white rounded-full p-0.5"><X className="w-3 h-3" /></button>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <button
            type="submit"
            disabled={isSaving}
            className="w-full bg-[#0286cd] hover:bg-[#026fa8] text-white font-black py-4 rounded-2xl text-xs sm:text-sm transition-all shadow-xl cursor-pointer flex items-center justify-center gap-2"
          >
            <CheckCircle2 className="w-5 h-5 text-white" />
            {isSaving ? 'SAVING CHANGES...' : 'SAVE & UPDATE REQUEST DETAILS'}
          </button>
        </form>
      </div>
    </div>
  );
}

/* =========================================================================
   LOGIN PORTAL COMPONENT (CLEAN SINGLE-CARD AUTO-ROLE AUTHENTICATION)
   ========================================================================= */
function LoginPortal({ onLogin, dbStatus, customerAccounts, onOpenRegister }) {
  // Demo shortcuts exist only in `npm run dev`. A production build never shows or prefills credentials.
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [selectedDemoRole, setSelectedDemoRole] = useState(null);
  const [showDevBar, setShowDevBar] = useState(IS_DEV);

  const handleFormSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setErrorMsg('');
    try {
      const res = await fetch(`${API_BASE}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password })
      });
      const data = await res.json();
      setLoading(false);
      if (res.ok && data.user) {
        onLogin(data.user, data.accessToken, data.refreshToken);
      } else {
        setErrorMsg(data.error || 'Invalid credentials.');
      }
    } catch (err) {
      setLoading(false);
      // No offline or mock login: the server must confirm the email and password against the database
      setErrorMsg('Cannot reach the server. Check that the API is running and try again.');
    }
  };

  return (
    <div className="min-h-screen text-slate-800 flex flex-col justify-between p-4 lg:p-8 login-card-gradient">
      {/* Top Header - Aligned with the max-w-md login panel */}
      <header className="max-w-md w-full mx-auto py-4">
        <div className="flex items-center gap-3">
          <div className="bg-[#e4e4e4] p-2 rounded-xl shadow-sm border border-slate-300 flex items-center justify-center shrink-0">
            <img src="/logo.webp" alt="SA Commercial Cleaning Logo" className="h-9 w-auto object-contain" />
          </div>
          <div>
            <h1 className="text-lg font-black tracking-tight text-slate-900 leading-tight">
              SA Emergency Cleaning
            </h1>
            <p className="text-[11px] text-[#0286cd] font-semibold leading-tight">
              Emergency Cleaning Membership Portal • South Australia
            </p>
          </div>
        </div>
      </header>

      {/* Main Centered Login Card */}
      <main className="max-w-md w-full mx-auto my-auto py-6">
        <div className="bg-white p-8 rounded-3xl space-y-6 border border-slate-200 shadow-xl shadow-slate-300/40">
          {/* Logo Showcase at Top of Form with #e4e4e4 background */}
          <div className="text-center">
            <div className="p-3.5 rounded-2xl bg-[#e4e4e4] inline-block shadow-sm border border-slate-300">
              <img src="/logo.webp" alt="SA Commercial Cleaning Services Logo" className="h-16 w-auto mx-auto object-contain" />
            </div>
          </div>

          {/* Development Quick Demo Login Bar with Toggle (npm run dev only) */}
          {IS_DEV && (
          <div className="space-y-2">
            <div className="flex items-center justify-between px-1">
              <span className="text-[10px] font-extrabold uppercase text-slate-400 tracking-wider">
                {showDevBar ? '🛠️ Dev Demo Login:' : 'Quick Login'}
              </span>
              <button
                type="button"
                onClick={() => setShowDevBar(!showDevBar)}
                className="text-[10px] font-bold text-slate-400 hover:text-[#0286cd] transition-colors cursor-pointer flex items-center gap-1"
                title={showDevBar ? "Hide Demo Bar (Normal User Mode)" : "Show Dev Demo Bar"}
              >
                <span>{showDevBar ? 'Hide Dev Bar ✕' : '🛠️ Show Demo Accounts'}</span>
              </button>
            </div>

            {showDevBar && (
              <div className="bg-slate-50 border border-slate-200 rounded-2xl p-2.5 text-center transition-all animate-in fade-in duration-150">
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setEmail('mahima@mahimaenterprises.com.au');
                      setPassword('Password123!');
                      setSelectedDemoRole('customer');
                      setErrorMsg('');
                    }}
                    className={`flex-1 py-1.5 px-2 rounded-xl text-[11px] transition-all cursor-pointer border ${
                      selectedDemoRole === 'customer'
                        ? 'bg-[#0286cd] text-white font-extrabold shadow-sm border-[#0286cd] ring-2 ring-[#0286cd]/30'
                        : 'bg-white hover:bg-blue-50 border-blue-200 text-[#0286cd] font-bold'
                    }`}
                  >
                    Customer
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setEmail('dave@sacleaning.com.au');
                      setPassword('Password123!');
                      setSelectedDemoRole('technician');
                      setErrorMsg('');
                    }}
                    className={`flex-1 py-1.5 px-2 rounded-xl text-[11px] transition-all cursor-pointer border ${
                      selectedDemoRole === 'technician'
                        ? 'bg-amber-600 text-white font-extrabold shadow-sm border-amber-600 ring-2 ring-amber-500/30'
                        : 'bg-white hover:bg-amber-50 border-amber-200 text-amber-700 font-bold'
                    }`}
                  >
                    Tech
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setEmail('admin@sacleaning.com.au');
                      setPassword('Password123!');
                      setSelectedDemoRole('admin');
                      setErrorMsg('');
                    }}
                    className={`flex-1 py-1.5 px-2 rounded-xl text-[11px] transition-all cursor-pointer border ${
                      selectedDemoRole === 'admin'
                        ? 'bg-purple-600 text-white font-extrabold shadow-sm border-purple-600 ring-2 ring-purple-500/30'
                        : 'bg-white hover:bg-purple-50 border-purple-200 text-purple-700 font-bold'
                    }`}
                  >
                    Admin
                  </button>
                </div>
              </div>
            )}
          </div>
          )}

          {errorMsg && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-red-700 text-xs font-semibold flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-red-500 shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          <form onSubmit={handleFormSubmit} className="space-y-4 text-xs">
            <div>
              <label className="block text-slate-700 font-bold mb-1.5">Email / Username</label>
              <div className="relative">
                <User className="w-4 h-4 text-[#0286cd] absolute left-3.5 top-3.5" />
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="name@business.com.au"
                  className="w-full bg-slate-50 border border-slate-300 rounded-xl py-3 pl-10 pr-3 text-slate-900 focus:outline-none focus:border-[#0286cd] font-medium transition-all shadow-sm"
                />
              </div>
            </div>

            <div>
              <label className="block text-slate-700 font-bold mb-1.5">Password</label>
              <div className="relative">
                <Shield className="w-4 h-4 text-[#0286cd] absolute left-3.5 top-3.5" />
                <input
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-300 rounded-xl py-3 pl-10 pr-3 text-slate-900 focus:outline-none focus:border-[#0286cd] font-medium transition-all shadow-sm"
                />
              </div>
            </div>

            <div className="flex items-center justify-between text-[11px] text-slate-600">
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" defaultChecked className="rounded border-slate-300 bg-slate-50 text-[#0286cd] focus:ring-0" />
                <span>Remember session</span>
              </label>
              <a href="#forgot" onClick={(e) => e.preventDefault()} className="text-[#0286cd] hover:underline font-semibold">Forgot password?</a>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-[#0286cd] hover:bg-[#026fa8] text-white font-extrabold py-3.5 rounded-xl text-xs flex items-center justify-center gap-2 transition-all shadow-md shadow-[#0286cd]/20 cursor-pointer"
            >
              {loading ? <RefreshCw className="w-4 h-4 animate-spin" /> : <ArrowRight className="w-4 h-4" />}
              <span>Sign In</span>
            </button>

            <div className="pt-4 border-t border-slate-200 text-center space-y-2">
              <p className="text-[11px] text-slate-500 font-semibold">New Adelaide business customer?</p>
              <button
                type="button"
                onClick={onOpenRegister}
                className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold py-3 rounded-xl text-xs flex items-center justify-center gap-2 transition-all shadow-md cursor-pointer"
              >
                <Building className="w-4 h-4" />
                <span>Register New Business Account</span>
              </button>
            </div>
          </form>
        </div>
      </main>

      {/* Footer - Aligned with max-w-md login panel */}
      <footer className="max-w-md w-full mx-auto py-4 text-center text-xs text-slate-500 border-t border-slate-200">
        <p>© 2026 SA Commercial Cleaning Services Pty Ltd (SACC). All rights reserved.</p>
      </footer>
    </div>
  );
}

/* =========================================================================
   MODAL: ADMIN JOB DETAILS (FOR NEW, ACCEPTED & COMPLETED REQUESTS)
   ========================================================================= */
function AdminJobDetailsModal({ job, onClose, onDispatchClick }) {
  if (!job) return null;
  const photos = Array.isArray(job.photos) ? job.photos : JSON.parse(job.photosJson || '[]');
  const videos = Array.isArray(job.videos) ? job.videos : JSON.parse(job.videosJson || '[]');

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/70 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-white max-w-2xl w-full p-6 rounded-3xl space-y-5 border border-slate-200 shadow-2xl text-xs text-slate-800 max-h-[92vh] overflow-y-auto custom-scroll-container">
        
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-200 pb-3">
          <div>
            <div className="flex items-center gap-2">
              <span className="font-mono font-black text-sm text-[#0286cd] bg-blue-50 px-2.5 py-0.5 rounded border border-blue-200">
                {job.jobNumber || job.id}
              </span>
              <span className={`font-black px-2.5 py-0.5 rounded-full text-[11px] uppercase tracking-wider ${
                job.status === 'NEW' || job.status === 'SUBMITTED' ? 'bg-blue-600 text-white shadow-sm' :
                job.status === 'COMPLETED' ? 'bg-purple-100 text-purple-900 border border-purple-300' :
                job.status === 'IN_PROGRESS' ? 'bg-amber-100 text-amber-900 border border-amber-300' :
                'bg-emerald-100 text-emerald-900 border border-emerald-300'
              }`}>
                {job.status.replace(/_/g, ' ')}
              </span>
            </div>
            <h3 className="text-lg font-black text-slate-900 mt-1">{job.customerName} — {job.category} Emergency</h3>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-700 cursor-pointer p-1"><X className="w-5 h-5" /></button>
        </div>

        {/* Customer & Location */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div className="bg-slate-50 p-3.5 rounded-2xl border border-slate-200 space-y-1">
            <div className="font-bold text-slate-500 text-[11px] uppercase tracking-wider">Customer Contact Info</div>
            <div className="font-extrabold text-slate-900">{job.onsiteContact || job.customerName}</div>
            <div className="text-slate-600 font-medium">📞 Phone: <a href={`tel:${job.onsitePhone}`} className="text-[#0286cd] font-bold hover:underline">{job.onsitePhone || 'Not specified'}</a></div>
            <div className="text-slate-500 text-[11px]">Submitted: {job.submittedAt ? new Date(job.submittedAt).toLocaleString() : 'Recent'}</div>
          </div>

          <div className="bg-slate-50 p-3.5 rounded-2xl border border-slate-200 space-y-1">
            <div className="font-bold text-slate-500 text-[11px] uppercase tracking-wider">Site Location & Address</div>
            <div className="font-extrabold text-slate-900">{job.locationName || 'Service Site'}</div>
            <div className="text-slate-600 font-medium truncate">{job.address}</div>
            <a href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(job.address)}`} target="_blank" rel="noreferrer" className="text-[#0286cd] font-bold text-[11px] hover:underline flex items-center gap-1 mt-0.5">
              <span>📍 Open in Google Maps</span>
            </a>
          </div>
        </div>

        {/* Incident Details Grid */}
        <div className="bg-blue-50/60 p-4 rounded-2xl border border-blue-200 space-y-3">
          <div className="font-bold text-[#0286cd] uppercase text-xs tracking-wider">Incident Technical Specifications</div>
          
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-center text-slate-800 font-bold">
            <div className="bg-white p-2.5 rounded-xl border border-blue-100 shadow-sm">
              <div className="text-[10px] text-slate-400 font-normal uppercase">Affected Area</div>
              <div className="text-xs font-extrabold text-slate-900">{job.affectedArea ? `${job.affectedArea} m²` : 'N/A'}</div>
            </div>

            <div className="bg-white p-2.5 rounded-xl border border-blue-100 shadow-sm">
              <div className="text-[10px] text-slate-400 font-normal uppercase">Incident Time</div>
              <div className="text-xs font-extrabold text-slate-900">{job.incidentTime ? new Date(job.incidentTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'Recent'}</div>
            </div>

            <div className="bg-white p-2.5 rounded-xl border border-blue-100 shadow-sm">
              <div className="text-[10px] text-slate-400 font-normal uppercase">Still Ongoing?</div>
              <div className="text-xs font-extrabold text-slate-900">{job.isOngoing ? '🔴 YES' : '🟢 NO'}</div>
            </div>

            <div className="bg-white p-2.5 rounded-xl border border-blue-100 shadow-sm">
              <div className="text-[10px] text-slate-400 font-normal uppercase">Safe to Access?</div>
              <div className="text-xs font-extrabold text-slate-900">{job.isSafeToAccess !== false ? '✅ SAFE' : '⚠️ HAZARD'}</div>
            </div>
          </div>

          <div>
            <div className="text-[11px] font-bold text-slate-700">Detailed Description of Incident:</div>
            <div className="bg-white p-3 rounded-xl border border-slate-200 text-slate-800 font-medium italic mt-1 text-xs">
              "{job.description || 'No additional description provided.'}"
            </div>
          </div>
        </div>

        {/* Site Access & Security Instructions */}
        <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200 space-y-2">
          <div className="font-bold text-slate-800 text-xs uppercase tracking-wider">Access, Security & Parking Instructions</div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-xs">
            <div>
              <span className="font-bold text-slate-700 block">Access Instructions:</span>
              <span className="text-slate-600 font-medium">{job.accessInstructions || 'Standard keycard/reception access.'}</span>
            </div>
            <div>
              <span className="font-bold text-slate-700 block">Access Restrictions:</span>
              <span className="text-slate-600 font-medium">{job.accessRestrictions || 'None reported.'}</span>
            </div>
            <div>
              <span className="font-bold text-slate-700 block">Parking / Security:</span>
              <span className="text-slate-600 font-medium">{job.parkingInstructions || 'Use visitor bay / loading dock.'}</span>
            </div>
          </div>
        </div>

        {/* Media Attachments */}
        {(photos.length > 0 || videos.length > 0) && (
          <div className="space-y-3 bg-slate-50 p-4 rounded-2xl border border-slate-200">
            <div className="font-bold text-slate-800 text-xs uppercase tracking-wider">Incident Media Attachments</div>

            {photos.length > 0 && (
              <div className="grid grid-cols-3 gap-2">
                {photos.map((src, i) => (
                  <a key={i} href={src} target="_blank" rel="noreferrer">
                    <img src={src} alt="Incident Photo" className="w-full h-24 object-cover rounded-xl border border-slate-300 hover:opacity-90 shadow-sm transition-all" />
                  </a>
                ))}
              </div>
            )}

            {videos.length > 0 && (
              <div className="space-y-2">
                <div className="text-[11px] font-bold text-slate-700">Incident Videos ({videos.length}):</div>
                <div className="grid grid-cols-2 gap-2">
                  {videos.map((vid, idx) => (
                    <video key={idx} controls src={vid} className="w-full rounded-xl border border-slate-300 bg-black h-28 object-cover shadow-sm" />
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* PDF Completion Report & Download Options - Available for Completed Jobs */}
        {['COMPLETED', 'REPORT_ISSUED', 'CLOSED'].includes(job.status) && (
          <div className="bg-emerald-50 p-4 rounded-2xl border border-emerald-200 flex flex-wrap items-center justify-between gap-3">
            <div>
              <div className="font-extrabold text-emerald-900 text-xs">Official Emergency Service Completion Report</div>
              <div className="text-[11px] text-emerald-700 font-medium">Technician verified work, digital sign-off & SLA audit log ready.</div>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => openPrintableReport(job.id)}
                className="bg-[#0286cd] hover:bg-[#026fa8] text-white font-extrabold px-3.5 py-2 rounded-xl text-xs flex items-center gap-1.5 shadow transition-all cursor-pointer"
              >
                <FileText className="w-4 h-4 text-white" /> View PDF
              </button>
              <button
                onClick={() => handleDownloadPdfReport(job.id, job.jobNumber)}
                className="bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold px-3.5 py-2 rounded-xl text-xs flex items-center gap-1.5 shadow transition-all cursor-pointer inline-flex items-center"
              >
                <Download className="w-4 h-4 text-white" /> 📥 Download
              </button>
            </div>
          </div>
        )}

        {/* Assigned Technician & Actions */}
        <div className="bg-slate-100 p-3.5 rounded-2xl border border-slate-300 flex items-center justify-between">
          <div>
            <span className="text-slate-500 font-bold text-[11px] uppercase">Assigned Technician:</span>
            <div className="font-extrabold text-slate-900 text-sm mt-0.5">{job.technicianName || 'Unassigned'}</div>
          </div>
          <button
            onClick={() => {
              onClose();
              if (onDispatchClick) onDispatchClick(job);
            }}
            className="bg-[#0286cd] hover:bg-[#026fa8] text-white font-extrabold px-4 py-2 rounded-xl text-xs shadow transition-all cursor-pointer"
          >
            ⚡ Dispatch / Reassign Technician
          </button>
        </div>

        <div className="pt-2 flex justify-end">
          <button onClick={onClose} className="bg-slate-800 hover:bg-slate-900 text-white font-bold px-6 py-2.5 rounded-xl cursor-pointer">
            Close Details
          </button>
        </div>
      </div>
    </div>
  );
}

/* =========================================================================
   MODAL: LIVE TECHNICIAN GPS LOCATION MAP (ADMIN OPERATIONS)
   ========================================================================= */
function LiveTechnicianMapModal({ job, onClose }) {
  if (!job) return null;

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/80 backdrop-blur-md flex items-center justify-center p-4">
      <div className="bg-white max-w-3xl w-full rounded-3xl overflow-hidden border border-slate-200 shadow-2xl text-xs text-slate-800 space-y-0">
        
        {/* Top Header */}
        <div className="bg-slate-900 p-5 text-white flex items-center justify-between border-b border-slate-800">
          <div className="flex items-center gap-3">
            <div className="relative flex h-3.5 w-3.5">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-3.5 w-3.5 bg-emerald-500"></span>
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-mono font-bold text-xs bg-blue-900 text-blue-300 px-2 py-0.5 rounded border border-blue-700">
                  {job.jobNumber || job.id}
                </span>
                <span className="text-emerald-400 font-extrabold text-xs tracking-wider uppercase">
                  🔴 LIVE GPS DISPATCH TELEMETRY
                </span>
              </div>
              <h3 className="text-base font-extrabold text-white mt-1">
                {job.customerName} — {job.locationName || 'Service Site'}
              </h3>
            </div>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-white cursor-pointer p-1"><X className="w-6 h-6" /></button>
        </div>

        {/* Live Telemetry Info Bar */}
        <div className="bg-blue-950 p-4 text-white border-b border-blue-900 grid grid-cols-2 sm:grid-cols-4 gap-3 text-center">
          <div className="bg-blue-900/60 p-2.5 rounded-2xl border border-blue-800">
            <div className="text-[10px] text-blue-300 font-bold uppercase">Technician</div>
            <div className="font-extrabold text-white text-xs mt-0.5 truncate">{job.technicianName || 'Dave Miller'}</div>
          </div>
          <div className="bg-blue-900/60 p-2.5 rounded-2xl border border-blue-800">
            <div className="text-[10px] text-blue-300 font-bold uppercase">Transit Speed</div>
            <div className="font-extrabold text-emerald-400 text-xs mt-0.5">38 km/h (Active)</div>
          </div>
          <div className="bg-blue-900/60 p-2.5 rounded-2xl border border-blue-800">
            <div className="text-[10px] text-blue-300 font-bold uppercase">Distance to Site</div>
            <div className="font-extrabold text-white text-xs mt-0.5">1.4 km away</div>
          </div>
          <div className="bg-blue-900/60 p-2.5 rounded-2xl border border-blue-800">
            <div className="text-[10px] text-blue-300 font-bold uppercase">Estimated Arrival (ETA)</div>
            <div className="font-extrabold text-amber-400 text-xs mt-0.5">14 Mins (On Time)</div>
          </div>
        </div>

        {/* Interactive Satellite / Vector Live Route Map Visualizer */}
        <div className="relative bg-slate-900 h-80 w-full overflow-hidden border-b border-slate-200">
          <iframe
            title="Live GPS Map"
            width="100%"
            height="100%"
            frameBorder="0"
            scrolling="no"
            src={`https://maps.google.com/maps?q=${encodeURIComponent(job.address || 'King William St, Adelaide CBD')}&t=&z=15&ie=UTF8&iwloc=&output=embed`}
            className="w-full h-full opacity-90 filter contrast-125"
          ></iframe>

          {/* Floating HUD Live Telemetry Overlay */}
          <div className="absolute top-4 left-4 bg-slate-900/90 backdrop-blur-md text-white p-3 rounded-2xl border border-slate-700 shadow-2xl max-w-xs space-y-1 text-xs">
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-ping"></span>
              <span className="font-extrabold text-emerald-400">Transmitting GPS Coordinates</span>
            </div>
            <p className="text-[11px] text-slate-300 font-mono">Lat: -34.9285° S, Lon: 138.6007° E</p>
            <p className="text-[11px] text-slate-300">📍 Grenfell St & King William St, Adelaide CBD</p>
          </div>

          {/* Floating Technician Vehicle Avatar Marker */}
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-slate-900/95 backdrop-blur-md p-2 rounded-2xl border-2 border-[#0286cd] shadow-2xl flex items-center gap-2 animate-bounce">
            <img
              src="https://images.unsplash.com/photo-1560250097-0b93528c311a?auto=format&fit=crop&w=150&q=80"
              alt="Dave Miller"
              className="w-8 h-8 rounded-xl object-cover border border-white"
            />
            <div className="text-[11px] text-white">
              <div className="font-black text-[#0286cd]">{job.technicianName || 'Dave Miller'}</div>
              <div className="text-[9px] text-emerald-400 font-bold">🚗 En route to site</div>
            </div>
          </div>
        </div>

        {/* Footer Details & Direct Action Buttons */}
        <div className="p-5 bg-slate-50 flex flex-wrap items-center justify-between gap-4 text-xs">
          <div>
            <div className="font-extrabold text-slate-900">Destination: {job.locationName || 'Service Location'}</div>
            <div className="text-slate-600 font-medium truncate max-w-md">{job.address}</div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <a
              href={`tel:${job.onsitePhone || '0488111222'}`}
              className="bg-emerald-600 hover:bg-emerald-500 text-white font-bold px-4 py-2.5 rounded-xl flex items-center gap-1.5 shadow cursor-pointer text-xs"
            >
              <Phone className="w-4 h-4 text-white" />
              <span>Call Technician Direct</span>
            </a>

            <a
              href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(job.address || 'Adelaide CBD')}`}
              target="_blank"
              rel="noreferrer"
              className="bg-[#0286cd] hover:bg-[#026fa8] text-white font-bold px-4 py-2.5 rounded-xl flex items-center gap-1.5 shadow cursor-pointer text-xs"
            >
              <MapPin className="w-4 h-4 text-white" />
              <span>Open in Google Maps</span>
            </a>

            <button
              onClick={onClose}
              className="bg-slate-800 hover:bg-slate-900 text-white font-bold px-5 py-2.5 rounded-xl cursor-pointer text-xs"
            >
              Close Live Map
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
