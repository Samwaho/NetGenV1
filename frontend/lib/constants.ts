import {
  Users,
  Box,
  Package,
  Ticket,
  DollarSign,
  Warehouse,
  Building,
  LayoutDashboard,
} from "lucide-react";

interface SidebarItem {
  title: string;
  path: (organizationId: string) => string;
  icon:
    | typeof LayoutDashboard
    | typeof Users 
    | typeof Box
    | typeof Building
    | typeof Package
    | typeof Ticket
    | typeof DollarSign
    | typeof Warehouse;
}

export const sidebarData: SidebarItem[] = [
  {
    title: "Dashboard",
    path: (id) => `/${id}/isp`,
    icon: LayoutDashboard,
  },
  {
    title: "Customers",
    path: (id) => `/${id}/isp/customers`,
    icon: Users,
  },
  {
    title: "Packages",
    path: (id) => `/${id}/isp/packages`,
    icon: Box,
  },
  {
    title: "Stations",
    path: (id) => `/${id}/isp/stations`,
    icon: Building,
  },
  {
    title: "Inventory",
    path: (id) => `/${id}/isp/inventory`,
    icon: Package,
  },
  {
    title: "Support Tickets",
    path: (id) => `/${id}/isp/tickets`,
    icon: Ticket,
  },
  {
    title: "Transactions",
    path: (id) => `/${id}/isp/transactions`,
    icon: DollarSign,
  },
  {
    title: "Messaging",
    path: (id) => `/${id}/isp/messaging`,
    icon: Warehouse,
  },
];
