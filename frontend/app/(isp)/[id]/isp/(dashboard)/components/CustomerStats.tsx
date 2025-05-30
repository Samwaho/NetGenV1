"use client";

import { Loader2, Users, TrendingUp, Signal, Wifi, WifiOff } from "lucide-react";
import { cn } from "@/lib/utils";

// Types for the component
interface ISPCustomer {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  username: string;
  status: string;
  online: boolean;
  expirationDate: string;
  package?: {
    id: string;
    name: string;
  };
}

interface CustomerStatsProps {
  customers: ISPCustomer[];
}

const LoadingState = () => (
  <div className="flex flex-col items-center justify-center h-[120px]">
    <Loader2 className="h-8 w-8 animate-spin text-primary" />
    <span className="text-sm text-muted-foreground mt-2">Loading customers...</span>
  </div>
);

const EmptyState = () => (
  <div className="flex flex-col items-center justify-center h-[120px] text-center">
    <div className="p-2 bg-accent rounded-full mb-2">
      <Users className="h-5 w-5 text-accent-foreground" />
    </div>
    <p className="text-sm text-muted-foreground">No customers yet</p>
  </div>
);

export function CustomerStats({ customers }: CustomerStatsProps) {
  if (customers.length === 0) return <EmptyState />;

  const totalCustomers = customers.length;
  const activeCustomers = customers.filter(c => c.status === "ACTIVE").length;
  const onlineCustomers = customers.filter(c => c.online).length;
  const activePercentage = ((activeCustomers / totalCustomers) * 100).toFixed(1);

  // Calculate customers expiring in the next 7 days
  const today = new Date();
  const nextWeek = new Date(today.getTime() + 7 * 24 * 60 * 60 * 1000);
  const expiringNextWeek = customers.filter(
    c => c.expirationDate && new Date(c.expirationDate) <= nextWeek && new Date(c.expirationDate) > today
  ).length;

  // Get customers by package type
  const customersByPackage = customers.reduce((acc: Record<string, number>, customer: ISPCustomer) => {
    const packageName = customer.package?.name || 'No Package';
    acc[packageName] = (acc[packageName] || 0) + 1;
    return acc;
  }, {});

  // Find most popular package
  const packageEntries = Object.entries(customersByPackage);
  const mostPopularPackage = packageEntries.length > 0 
    ? packageEntries.sort((a, b) => b[1] - a[1])[0] 
    : null;

  return (
    <div className="space-y-4">
      <div className="flex flex-col">
        <div className="flex items-center justify-between">
          <div className="text-2xl font-bold text-foreground">
            {totalCustomers}
          </div>
          {expiringNextWeek > 0 && (
            <div className="flex items-center gap-1 text-chart-4">
              <Signal className="h-4 w-4" />
              <span className="text-xs font-medium">
                {expiringNextWeek} expiring soon
              </span>
            </div>
          )}
        </div>
        <div className="flex items-center justify-between mt-1">
          <div className="flex items-center gap-1.5">
            <div className={cn(
              "h-2 w-2 rounded-full",
              activeCustomers > 0 ? "bg-chart-3" : "bg-muted"
            )} />
            <span className="text-xs text-muted-foreground">
              {activeCustomers} active now
            </span>
          </div>
          <span className="text-xs font-medium text-gradient-custom">
            {activePercentage}%
          </span>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <div className="flex items-center gap-2 p-2 border rounded-lg bg-card">
          <div className="p-1.5 bg-chart-3/20 rounded-full">
            <Wifi className="h-3.5 w-3.5 text-chart-3" />
          </div>
          <div className="min-w-0">
            <p className="text-xs font-medium text-foreground">Online</p>
            <p className="text-xs text-muted-foreground truncate">{onlineCustomers} users</p>
          </div>
        </div>
        <div className="flex items-center gap-2 p-2 border rounded-lg bg-card">
          <div className="p-1.5 bg-secondary/20 rounded-full">
            <WifiOff className="h-3.5 w-3.5 text-secondary-foreground" />
          </div>
          <div className="min-w-0">
            <p className="text-xs font-medium text-foreground">Offline</p>
            <p className="text-xs text-muted-foreground truncate">{totalCustomers - onlineCustomers} users</p>
          </div>
        </div>
      </div>

      {mostPopularPackage && (
        <div className="pt-3 border-t">
          <div className="flex items-center gap-2">
            <div className="p-1.5 bg-gradient-custom rounded-full">
              <TrendingUp className="h-4 w-4 text-white" />
            </div>
            <div className="min-w-0">
              <p className="text-xs text-muted-foreground">Most popular plan</p>
              <p className="text-sm font-medium text-foreground truncate">
                {mostPopularPackage[0]}
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
