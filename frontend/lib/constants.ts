import {
  Users,
  Box,
  Package,
  UserCog,
  Ticket,
  DollarSign,
  Warehouse,
  Building,
  LayoutDashboard,
} from "lucide-react";

interface SidebarItem {
  title: string;
  path: string;
  icon:
    | typeof LayoutDashboard
    | typeof Users 
    | typeof Box
    | typeof Building
    | typeof Package
    | typeof UserCog
    | typeof Ticket
    | typeof DollarSign
    | typeof Warehouse;
}

export const sidebarData: SidebarItem[] = [
  {
    title: "Dashboard",
    path: "/isp",
    icon: LayoutDashboard,
  },
  {
    title: "Customers",
    path: "/isp/customers",
    icon: Users,
  },
  {
    title: "Packages",
    path: "/isp/packages",
    icon: Box,
  },
  {
    title: "Stations",
    path: "/isp/stations",
    icon: Building,
  },
  {
    title: "Inventory",
    path: "/isp/inventory",
    icon: Package,
  },
  {
    title: "Staff",
    path: "/isp/staff",
    icon: UserCog,
  },
  {
    title: "Support Tickets",
    path: "/isp/tickets",
    icon: Ticket,
  },
  {
    title: "Transactions",
    path: "/isp/transactions",
    icon: DollarSign,
  },
  {
    title: "Agency",
    path: "/isp/agency",
    icon: Warehouse,
  },
];