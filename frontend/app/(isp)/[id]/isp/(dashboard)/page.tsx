import { Metadata } from "next";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { CustomerStats } from "./components/CustomerStats";
import { TicketStats } from "./components/TicketStats";
import { InventoryStats } from "./components/InventoryStats";
import { RevenueChart } from "./components/RevenueChart";
import { PackageChart } from "./components/PackageChart";
import { Users, TicketIcon, Package, DollarSign, PieChart } from "lucide-react";

export const metadata: Metadata = {
  title: "ISP Dashboard",
  description: "Overview of your ISP business metrics",
};

export default function DashboardPage() {
  return (
    <div className="container mx-auto px-4 sm:px-6 py-4 sm:py-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">Dashboard</h1>
        <div className="flex items-center text-xs sm:text-sm text-muted-foreground">
          <span>Last updated: {new Date().toLocaleDateString()}</span>
        </div>
      </div>

      <div className="grid gap-4 sm:gap-6 sm:grid-cols-2 lg:grid-cols-3 w-full">
        {/* Summary Cards */}
        <Card className="transition-shadow hover:shadow-md">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Customer Overview
            </CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <CustomerStats />
          </CardContent>
        </Card>

        <Card className="transition-shadow hover:shadow-md">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Support Tickets
            </CardTitle>
            <TicketIcon className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <TicketStats />
          </CardContent>
        </Card>

        <Card className="transition-shadow hover:shadow-md sm:col-span-2 lg:col-span-1">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Inventory Status
            </CardTitle>
            <Package className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <InventoryStats />
          </CardContent>
        </Card>
      </div>

      <div className="mt-4 sm:mt-6 grid gap-4 sm:gap-6 md:grid-cols-2 lg:grid-cols-3">
        {/* Additional Dashboard Widgets */}
        <Card className="col-span-full lg:col-span-1 transition-shadow hover:shadow-md">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Package Distribution
            </CardTitle>
            <PieChart className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <PackageChart />
          </CardContent>
        </Card>

        <Card className="col-span-full lg:col-span-1 transition-shadow hover:shadow-md">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Network Status
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-[280px] sm:h-[320px] flex items-center justify-center border-2 border-dashed rounded-lg">
              <p className="text-xs sm:text-sm text-muted-foreground text-center px-4">
                Network status metrics will be displayed here
              </p>
            </div>
          </CardContent>
        </Card>

        <Card className="transition-shadow hover:shadow-md">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Revenue Overview
            </CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <RevenueChart />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
