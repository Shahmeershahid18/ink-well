import {
  Beaker,
  BarChart3,
  Boxes,
  Factory,
  LayoutDashboard,
  Package,
  Receipt,
  Settings,
  ShoppingCart,
  Truck,
  Users,
} from 'lucide-react'

export interface NavItem {
  href: string
  label: string
  icon: typeof LayoutDashboard
  /** Extra words the command palette should match on. */
  keywords?: string
}

export interface NavGroup {
  label: string
  items: NavItem[]
}

export const NAV: NavGroup[] = [
  {
    label: 'Overview',
    items: [
      { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard, keywords: 'home kpi summary' },
    ],
  },
  {
    label: 'Operations',
    items: [
      { href: '/purchases', label: 'Purchases', icon: ShoppingCart, keywords: 'buy supplier invoice' },
      { href: '/production', label: 'Production', icon: Factory, keywords: 'batch manufacture make' },
      { href: '/sales', label: 'Sales', icon: Receipt, keywords: 'invoice customer sell' },
    ],
  },
  {
    label: 'Catalogue',
    items: [
      { href: '/raw-materials', label: 'Raw materials', icon: Package, keywords: 'pigment resin solvent stock' },
      { href: '/inks', label: 'Inks', icon: Beaker, keywords: 'formula recipe product' },
      { href: '/inventory', label: 'Inventory ledger', icon: Boxes, keywords: 'movements audit trail' },
    ],
  },
  {
    label: 'Contacts',
    items: [
      { href: '/suppliers', label: 'Suppliers', icon: Truck, keywords: 'vendor payable' },
      { href: '/customers', label: 'Customers', icon: Users, keywords: 'client receivable' },
    ],
  },
  {
    label: 'Insight',
    items: [
      { href: '/reports', label: 'Reports', icon: BarChart3, keywords: 'profit loss export csv' },
      { href: '/settings', label: 'Settings', icon: Settings, keywords: 'company prefix currency' },
    ],
  },
]

export const ALL_NAV_ITEMS = NAV.flatMap((g) => g.items)
