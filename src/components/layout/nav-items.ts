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
  Share2,
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

/**
 * Everything behind "עוד", in groups.
 *
 * As one flat list of ten identical rows it read as a wall: nothing said which
 * row you wanted, so you scanned all ten every time. Grouping by what a row is
 * FOR — what is booked, what is still being planned, the trip itself — lands
 * the eye in the right block first.
 */
export interface NavGroup {
  title: string;
  items: NavItem[];
}

export const SECONDARY_GROUPS: NavGroup[] = [
  {
    title: 'ההזמנות',
    items: [
      { href: '/hotels', label: 'מלונות', icon: BedDouble },
      { href: '/flights', label: 'טיסות', icon: Plane },
      { href: '/car', label: 'רכב', icon: CarFront },
      { href: '/documents', label: 'מסמכים', icon: FileText },
    ],
  },
  {
    title: 'התכנון',
    items: [
      { href: '/today', label: 'היום', icon: Sun },
      { href: '/places', label: 'מקומות', icon: Heart },
      { href: '/search', label: 'חיפוש והוספה', icon: Search },
      { href: '/checklists', label: 'צ׳קליסטים', icon: CheckSquare },
      { href: '/assistant', label: 'עוזר AI', icon: Sparkles },
    ],
  },
  {
    title: 'הטיול',
    items: [
      { href: '/share', label: 'שיתוף עם אנשים', icon: Share2 },
      { href: '/settings', label: 'הגדרות', icon: Settings },
    ],
  },
];

/** Flat form, for the desktop sidebar and for route matching. */
export const SECONDARY_NAV: NavItem[] = SECONDARY_GROUPS.flatMap((g) => g.items);

export const ALL_NAV = [...PRIMARY_NAV, ...SECONDARY_NAV];
