const PATHS = {
  dashboard: <><rect x="3" y="3" width="8" height="10" rx="1.5" /><rect x="13" y="3" width="8" height="6" rx="1.5" /><rect x="13" y="11" width="8" height="10" rx="1.5" /><rect x="3" y="15" width="8" height="6" rx="1.5" /></>,
  bus: <path d="M5 17V6a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v11M5 12h14M7 20v-3M17 20v-3" />,
  people: <><circle cx="9" cy="8" r="3" /><circle cx="17" cy="9" r="2.5" /><path d="M3 20c.8-3.5 3.2-5 6-5s5.2 1.5 6 5M15 15.5c2.6 0 4.8 1.3 5.5 4.5" /></>,
  lines: <><circle cx="5" cy="6" r="2" /><circle cx="19" cy="18" r="2" /><path d="M7 6h8a3 3 0 0 1 0 6H9a3 3 0 0 0 0 6h8" /></>,
  calendar: <><rect x="3" y="5" width="18" height="16" rx="2" /><path d="M3 10h18M8 3v4M16 3v4" /></>,
  vehicle: <><circle cx="7" cy="17" r="2" /><circle cx="17" cy="17" r="2" /><path d="M3 15V7a2 2 0 0 1 2-2h11l5 5v5" /></>,
  duty: <><rect x="5" y="4" width="14" height="17" rx="2" /><path d="M9 10h6M9 14h6M9 18h3" /></>,
  chart: <path d="M4 20V10M10 20V4M16 20v-7M22 20H2" />,
  admin: <><circle cx="12" cy="12" r="3" /><path d="M12 2v3M12 19v3M4.2 4.2l2.1 2.1M17.7 17.7l2.1 2.1M2 12h3M19 12h3M4.2 19.8l2.1-2.1M17.7 6.3l2.1-2.1" /></>,
  ticket: <path d="M3 8a2 2 0 0 0 2-2h14a2 2 0 0 0 2 2v2a2 2 0 0 0 0 4v2a2 2 0 0 0-2 2H5a2 2 0 0 0-2-2v-2a2 2 0 0 0 0-4z" />,
  info: <><circle cx="12" cy="12" r="9" /><path d="M12 11v6M12 7.5v.5" strokeLinecap="round" /></>,
  menu: <path d="M4 7h16M4 12h16M4 17h16" strokeLinecap="round" />,
  user: <><circle cx="12" cy="8" r="4" /><path d="M4 21c1-4 4-6 8-6s7 2 8 6" /></>,
} as const;

export type IconName = keyof typeof PATHS;

export function Icon({ name, size = 24 }: { name: IconName; size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
      {PATHS[name]}
    </svg>
  );
}
