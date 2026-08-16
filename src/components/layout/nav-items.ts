import {
  BedDouble,
  Calendar,
  CarFront,
  CheckSquare,
  FileText,
  Heart,
  Home,
  Map,
  MoreHorizontal,
  Plane,
  Search,
  Settings,
  Sparkles,
  Sun,
  Wallet,
  type LucideIcon,
} from 'lucide-react';

export interface NavItem {
  href: string;
  label: string;
  icon: LucideIcon;
}

/** The five slots on the mobile tab bar. */
export const PRIMARY_NAV: NavItem[] = [
  { href: '/dashboard', label: 'בית', icon: Home },
  { href: '/itinerary', label: 'מסלול', icon: Calendar },
  { href: '/map', label: 'מפה', icon: Map },
  { href: '/budget', label: 'תקציב', icon: Wallet },
  { href: '/more', label: 'עוד', icon: MoreHorizontal },
];

/** Everything behind "עוד", also shown inline in the desktop sidebar. */
export const SECONDARY_NAV: NavItem[] = [
  { href: '/today', label: 'היום', icon: Sun },
  { href: '/hotels', label: 'מלונות', icon: BedDouble },
  { href: '/flights', label: 'טיסות', icon: Plane },
  { href: '/car', label: 'רכב', icon: CarFront },
  { href: '/places', label: 'מקומות', icon: Heart },
  { href: '/documents', label: 'מסמכים', icon: FileText },
  { href: '/checklists', label: 'צ׳קליסטים', icon: CheckSquare },
  { href: '/search', label: 'חיפוש והוספה', icon: Search },
  { href: '/assistant', label: 'עוזר AI', icon: Sparkles },
  { href: '/settings', label: 'הגדרות', icon: Settings },
];

export const ALL_NAV = [...PRIMARY_NAV, ...SECONDARY_NAV];
