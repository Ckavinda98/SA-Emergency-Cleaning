// Sidebar and mobile tab-bar items for each role (see section 3 of the redesign plan)
import {
  LayoutDashboard, ClipboardList, PlusCircle, Award, ShieldCheck, UserCog, Wrench, History, User,
  Radio, Map, Building2, Users, Gift, BarChart3, PhoneCall, Settings, Eye, MoreHorizontal
} from 'lucide-react';

export const NAV = {
  customer: [
    { to: '/app', label: 'Dashboard', icon: LayoutDashboard, end: true },
    { to: '/app/requests', label: 'Requests', icon: ClipboardList },
    { to: '/app/requests/new', label: 'New request', icon: PlusCircle },
    { to: '/app/rewards', label: 'Rewards', icon: Award },
    { to: '/app/membership', label: 'Membership', icon: ShieldCheck },
    { to: '/app/account', label: 'Account', icon: UserCog }
  ],
  technician: [
    { to: '/tech/jobs', label: 'My jobs', icon: Wrench },
    { to: '/tech/history', label: 'Job history', icon: History },
    { to: '/tech/profile', label: 'Profile', icon: User }
  ],
  admin: [
    { to: '/admin/dispatch', label: 'Dispatch', icon: Radio },
    { to: '/admin/map', label: 'Live map', icon: Map },
    { to: '/admin/customers', label: 'Customers', icon: Building2 },
    { to: '/admin/technicians', label: 'Technicians', icon: Users },
    { to: '/admin/rewards', label: 'Rewards queue', icon: Gift },
    { to: '/admin/reports', label: 'Reports', icon: BarChart3 },
    { to: '/admin/hotline', label: 'Hotline booking', icon: PhoneCall },
    { to: '/settings/pricing', label: 'Settings', icon: Settings }
  ],
  config: [
    { to: '/settings/pricing', label: 'Pricing & rules', icon: Settings }
  ]
};

// Admins can look at the other workspaces
export const ADMIN_VIEWS = [
  { to: '/app', label: 'Customer view', icon: Eye },
  { to: '/tech/jobs', label: 'Technician view', icon: Eye }
];

export const MOBILE_TABS = {
  customer: [
    { to: '/app', label: 'Home', icon: LayoutDashboard, end: true },
    { to: '/app/requests', label: 'Requests', icon: ClipboardList },
    { to: '/app/requests/new', label: 'Request', icon: PlusCircle, primary: true },
    { to: '/app/rewards', label: 'Rewards', icon: Award },
    { to: '/app/account', label: 'Account', icon: UserCog }
  ],
  technician: [
    { to: '/tech/jobs', label: 'Jobs', icon: Wrench },
    { to: '/tech/history', label: 'History', icon: History },
    { to: '/tech/profile', label: 'Profile', icon: User }
  ],
  admin: [
    { to: '/admin/dispatch', label: 'Dispatch', icon: Radio },
    { to: '/admin/map', label: 'Map', icon: Map },
    { to: '/admin/customers', label: 'Customers', icon: Building2 },
    { to: '/admin/technicians', label: 'Techs', icon: Users },
    { menu: true, label: 'More', icon: MoreHorizontal }
  ],
  config: []
};
