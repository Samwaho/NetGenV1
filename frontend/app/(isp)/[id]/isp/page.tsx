"use client";

import { useQuery } from "@apollo/client";
import { useParams } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { 
  Users, Package, Radio, Ticket, ArrowUpRight, ArrowDownRight, 
  Activity, AlertCircle, CheckCircle, Clock, DollarSign, 
  TrendingUp, TrendingDown, Wifi
} from "lucide-react";
import { GET_DASHBOARD_STATS } from "@/graphql/dashboard";
import { LineChart, Line, ResponsiveContainer, XAxis, YAxis, Tooltip, CartesianGrid, Legend } from "recharts";
import { formatCurrency, formatDate, formatNumber } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

interface StatsCardProps {
  title: string;
  value: string | number;
  description: string;
  icon: React.ReactNode;
  trend?: {
    value: number;
    isPositive: boolean;
  };
  className?: string;
}

interface RevenueDataItem {
  date: string;
  amount: number;
}

interface ActivityItem {
  id: string;
  type: string;
  description: string;
  timestamp: string;
}

interface DashboardStats {
  customers: {
    total: number;
    active: number;
    inactive: number;
    growth: number;
    churnRate: number;
    averageRevenue: number;
    newThisMonth: number;
    byPackage: Array<{
      name: string;
      count: number;
      revenue: number;
    }>;
  };
  stations: {
    total: number;
    active: number;
    inactive: number;
    growth: number;
    totalBandwidth: number;
    averageUptime: number;
    maintenanceNeeded: number;
    byStatus: Array<{
      status: string;
      count: number;
      bandwidth: number;
    }>;
  };
  tickets: {
    total: number;
    open: number;
    closed: number;
    growth: number;
    averageResolutionTime: number;
    byPriority: Array<{
      priority: string;
      count: number;
      avgResolutionTime: number;
    }>;
    byCategory: Array<{
      category: string;
      count: number;
    }>;
    satisfactionRate: number;
  };
  inventory: {
    total: number;
    lowStock: number;
    outOfStock: number;
    growth: number;
    totalValue: number;
    mostUsed: Array<{
      item: string;
      count: number;
      value: number;
    }>;
    reorderNeeded: Array<{
      item: string;
      currentStock: number;
      minimumRequired: number;
    }>;
    byCategory: Array<{
      category: string;
      count: number;
      value: number;
    }>;
  };
  revenue: {
    data: Array<{
      date: string;
      amount: number;
      recurring: number;
      oneTime: number;
      expenses: number;
    }>;
    growth: number;
    totalRevenue: number;
    recurringRevenue: number;
    averageRevenue: number;
    projectedRevenue: number;
    expenses: number;
    profitMargin: number;
  };
  bandwidth: {
    total: number;
    download: number;
    upload: number;
    peakTime: string;
    byPackage: Array<{
      package: string;
      usage: number;
      percentage: number;
    }>;
  };
  recentActivity: Array<{
    id: string;
    type: string;
    description: string;
    timestamp: string;
    user: string;
    category: string;
    impact: string;
    details: Record<string, any>;
  }>;
}

const StatsCard = ({ title, value, description, icon, trend, className = "" }: StatsCardProps & { className?: string }) => (
  <Card className={`transition-all hover:shadow-md ${className}`}>
    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
      <CardTitle className="text-sm font-medium">{title}</CardTitle>
      <div className={`p-2 rounded-full ${trend?.isPositive ? 'bg-green-50' : 'bg-red-50'}`}>
        {icon}
      </div>
    </CardHeader>
    <CardContent>
      <div className="text-2xl font-bold">{value}</div>
      <div className="flex items-center space-x-2 mt-2">
        <p className="text-xs text-muted-foreground">{description}</p>
        {trend && (
          <div className={`flex items-center text-xs ${trend.isPositive ? 'text-green-500' : 'text-red-500'}`}>
            {trend.isPositive ? <ArrowUpRight className="h-4 w-4" /> : <ArrowDownRight className="h-4 w-4" />}
            <span>{trend.value}%</span>
          </div>
        )}
      </div>
    </CardContent>
  </Card>
);

const ActivityBadge = ({ type }: { type: string }) => {
  const colors: Record<string, string> = {
    CUSTOMER: "bg-blue-100 text-blue-800",
    TICKET: "bg-purple-100 text-purple-800",
    PAYMENT: "bg-green-100 text-green-800",
    ALERT: "bg-red-100 text-red-800",
    DEFAULT: "bg-gray-100 text-gray-800"
  };

  return (
    <Badge className={colors[type] || colors.DEFAULT}>
      {type.toLowerCase()}
    </Badge>
  );
};

export default function ISPPage() {
  const params = useParams();
  const organizationId = params.id as string;

  const { data, loading, error } = useQuery(GET_DASHBOARD_STATS, {
    variables: { organizationId },
    pollInterval: 30000,
  });

  if (loading) {
    return (
      <div className="flex-1 p-4 md:p-8 pt-6">
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {[1, 2, 3, 4].map((i) => (
            <Card key={i} className="animate-pulse">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <div className="h-4 w-24 bg-gray-200 rounded"></div>
              </CardHeader>
              <CardContent>
                <div className="h-8 w-16 bg-gray-200 rounded mt-2"></div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex-1 p-4 md:p-8 pt-6">
        <Card className="bg-red-50 dark:bg-red-900/10 border-red-200">
          <CardContent className="p-4">
            <div className="flex items-center space-x-2">
              <AlertCircle className="h-5 w-5 text-red-600" />
              <p className="text-red-600 dark:text-red-400">Error loading dashboard data: {error.message}</p>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  const stats = data?.dashboardStats;
  const recentActivities = stats?.recentActivity || [];
  const revenueData = stats?.revenue.data.map((item: RevenueDataItem) => ({
    name: new Date(item.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
    total: item.amount,
    trend: item.amount * (1 + (Math.random() * 0.4 - 0.2)) // Simulated trend line
  })) || [];

  return (
    <div className="flex-1 space-y-6 p-4 md:p-8 pt-6">
      {/* Summary Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <StatsCard
          title="Total Customers"
          value={formatNumber(stats.customers.total)}
          description={`${stats.customers.active} active subscribers`}
          icon={<Users className="h-4 w-4 text-blue-600" />}
          trend={{ 
            value: Math.round(stats.customers.growth), 
            isPositive: stats.customers.growth >= 0 
          }}
        />
        <StatsCard
          title="Network Status"
          value={`${stats.stations.active}/${stats.stations.total}`}
          description={`${((stats.stations.active / stats.stations.total) * 100).toFixed(1)}% operational`}
          icon={<Radio className="h-4 w-4 text-green-600" />}
          trend={{ 
            value: Math.round(stats.stations.growth), 
            isPositive: stats.stations.growth >= 0 
          }}
        />
        <StatsCard
          title="Support Tickets"
          value={stats.tickets.open}
          description={`${((stats.tickets.open / stats.tickets.total) * 100).toFixed(1)}% resolution rate`}
          icon={<Ticket className="h-4 w-4 text-purple-600" />}
          trend={{ 
            value: Math.round(stats.tickets.growth), 
            isPositive: stats.tickets.growth < 0 
          }}
        />
        <StatsCard
          title="Inventory Health"
          value={stats.inventory.total}
          description={`${stats.inventory.lowStock} items need attention`}
          icon={<Package className="h-4 w-4 text-orange-600" />}
          trend={{ 
            value: Math.round(stats.inventory.growth), 
            isPositive: stats.inventory.growth >= 0 
          }}
        />
      </div>

      {/* Main Content */}
      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-7">
        {/* Revenue Chart */}
        <Card className="col-span-4">
          <Tabs defaultValue="revenue" className="w-full">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle>Financial Overview</CardTitle>
              <TabsList>
                <TabsTrigger value="revenue">Revenue</TabsTrigger>
                <TabsTrigger value="trends">Trends</TabsTrigger>
              </TabsList>
            </CardHeader>
            <CardContent>
              <TabsContent value="revenue" className="mt-0">
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <p className="text-2xl font-bold">{formatCurrency(revenueData[revenueData.length - 1]?.total || 0)}</p>
                    <p className="text-sm text-muted-foreground">Current Revenue</p>
                  </div>
                  <div className={`flex items-center ${stats.revenue.growth >= 0 ? 'text-green-500' : 'text-red-500'}`}>
                    {stats.revenue.growth >= 0 ? <TrendingUp className="h-4 w-4 mr-1" /> : <TrendingDown className="h-4 w-4 mr-1" />}
                    <span>{Math.abs(stats.revenue.growth)}% from last month</span>
                  </div>
                </div>
                <ResponsiveContainer width="100%" height={300}>
                  <LineChart data={revenueData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                    <XAxis dataKey="name" stroke="#888888" fontSize={12} tickLine={false} axisLine={false} />
                    <YAxis 
                      stroke="#888888" 
                      fontSize={12} 
                      tickLine={false} 
                      axisLine={false}
                      tickFormatter={(value) => formatCurrency(value)}
                    />
                    <Tooltip 
                      formatter={(value: number) => [formatCurrency(value), "Revenue"]}
                      contentStyle={{ backgroundColor: 'white', borderRadius: '8px', border: '1px solid #e5e7eb' }}
                    />
                    <Legend />
                    <Line 
                      type="monotone" 
                      dataKey="total" 
                      stroke="#8884d8" 
                      strokeWidth={2}
                      dot={false}
                      name="Revenue"
                    />
                    <Line 
                      type="monotone" 
                      dataKey="trend" 
                      stroke="#82ca9d" 
                      strokeWidth={2}
                      dot={false}
                      name="Trend"
                      strokeDasharray="5 5"
                    />
                  </LineChart>
                </ResponsiveContainer>
              </TabsContent>
              <TabsContent value="trends" className="mt-0">
                {/* Add additional financial metrics/charts here */}
              </TabsContent>
            </CardContent>
          </Tabs>
        </Card>

        {/* Activity Feed */}
        <Card className="col-span-3">
          <CardHeader>
            <CardTitle>Recent Activity</CardTitle>
            <CardDescription>Latest system events and updates</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-8">
              {recentActivities.length > 0 ? (
                recentActivities.map((activity: ActivityItem) => (
                  <div key={activity.id} className="flex items-start space-x-4">
                    <div className="p-2 rounded-full bg-gray-100">
                      <Activity className="h-4 w-4 text-gray-600" />
                    </div>
                    <div className="flex-1 space-y-1">
                      <div className="flex items-center space-x-2">
                        <ActivityBadge type={activity.type} />
                        <span className="text-xs text-muted-foreground">
                          {formatDate(activity.timestamp)}
                        </span>
                      </div>
                      <p className="text-sm font-medium">
                        {activity.description}
                      </p>
                    </div>
                  </div>
                ))
              ) : (
                <div className="flex flex-col items-center justify-center py-8 text-center">
                  <Activity className="h-8 w-8 text-gray-400 mb-2" />
                  <p className="text-sm text-muted-foreground">No recent activity</p>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Additional Metrics */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle>Network Health</CardTitle>
            <CardDescription>Overall system performance</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium">Uptime</span>
                  <span className="text-sm text-muted-foreground">99.9%</span>
                </div>
                <Progress value={99.9} className="h-2" />
              </div>
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium">Bandwidth Usage</span>
                  <span className="text-sm text-muted-foreground">78%</span>
                </div>
                <Progress value={78} className="h-2" />
              </div>
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium">Customer Satisfaction</span>
                  <span className="text-sm text-muted-foreground">92%</span>
                </div>
                <Progress value={92} className="h-2" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Support Overview</CardTitle>
            <CardDescription>Ticket status breakdown</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <p className="text-3xl font-bold text-green-500">{stats.tickets.total - stats.tickets.open}</p>
                  <p className="text-sm text-muted-foreground">Resolved</p>
                </div>
                <div className="space-y-2">
                  <p className="text-3xl font-bold text-red-500">{stats.tickets.open}</p>
                  <p className="text-sm text-muted-foreground">Open</p>
                </div>
              </div>
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium">Resolution Rate</span>
                  <span className="text-sm text-muted-foreground">
                    {((stats.tickets.total - stats.tickets.open) / stats.tickets.total * 100).toFixed(1)}%
                  </span>
                </div>
                <Progress 
                  value={((stats.tickets.total - stats.tickets.open) / stats.tickets.total * 100)} 
                  className="h-2" 
                />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Customer Insights</CardTitle>
            <CardDescription>Subscription and usage metrics</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <p className="text-3xl font-bold text-blue-500">{stats.customers.active}</p>
                  <p className="text-sm text-muted-foreground">Active Users</p>
                </div>
                <div className="space-y-2">
                  <p className="text-3xl font-bold text-yellow-500">
                    {((stats.customers.active / stats.customers.total) * 100).toFixed(1)}%
                  </p>
                  <p className="text-sm text-muted-foreground">Retention</p>
                </div>
              </div>
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium">Customer Health</span>
                  <span className="text-sm text-muted-foreground">
                    {((stats.customers.active / stats.customers.total) * 100).toFixed(1)}%
                  </span>
                </div>
                <Progress 
                  value={(stats.customers.active / stats.customers.total) * 100} 
                  className="h-2" 
                />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
