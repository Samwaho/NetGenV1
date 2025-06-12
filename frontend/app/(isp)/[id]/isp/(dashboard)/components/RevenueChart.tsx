"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ISPTransaction, TransactionType } from "@/types/isp_transaction";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { useMemo, useState } from "react";
import { format, subDays, subMonths, subYears, startOfDay, endOfDay, eachDayOfInterval, eachWeekOfInterval, eachMonthOfInterval, eachYearOfInterval } from "date-fns";
import { Loader2 } from "lucide-react";

type TimePeriod = "daily" | "weekly" | "monthly" | "yearly";

interface ChartData {
  date: string;
  revenue: number;
  customerPayments: number;
  voucherSales: number;
}

interface TimePeriodSelectorProps {
  value: TimePeriod;
  onChange: (value: TimePeriod) => void;
}

const TimePeriodSelector = ({ value, onChange }: TimePeriodSelectorProps) => (
  <Select value={value} onValueChange={onChange}>
    <SelectTrigger className="w-[180px]">
      <SelectValue placeholder="Select time period" />
    </SelectTrigger>
    <SelectContent>
      <SelectItem value="daily">Daily</SelectItem>
      <SelectItem value="weekly">Weekly</SelectItem>
      <SelectItem value="monthly">Monthly</SelectItem>
      <SelectItem value="yearly">Yearly</SelectItem>
    </SelectContent>
  </Select>
);

interface RevenueChartProps {
  transactions: ISPTransaction[];
  isLoading?: boolean;
}

export function RevenueChart({ transactions, isLoading }: RevenueChartProps) {
  const [timePeriod, setTimePeriod] = useState<TimePeriod>("daily");

  const { chartData, stats } = useMemo(() => {
    if (!transactions.length) return { chartData: [], stats: { totalRevenue: 0, totalCustomerPayments: 0, totalVoucherSales: 0, averageRevenue: 0 } };

    const now = new Date();
    let startDate: Date;
    let intervalFn: (interval: { start: Date; end: Date }) => Date[];

    switch (timePeriod) {
      case "daily":
        startDate = subDays(now, 7);
        intervalFn = eachDayOfInterval;
        break;
      case "weekly":
        startDate = subMonths(now, 1);
        intervalFn = eachWeekOfInterval;
        break;
      case "monthly":
        startDate = subMonths(now, 6);
        intervalFn = eachMonthOfInterval;
        break;
      case "yearly":
        startDate = subYears(now, 1);
        intervalFn = eachYearOfInterval;
        break;
    }

    const intervals = intervalFn({ start: startDate, end: now });
    const groupedData = new Map<string, { revenue: number; customerPayments: number; voucherSales: number }>();

    // Initialize all intervals with zero values
    intervals.forEach(date => {
      const key = format(date, timePeriod === "daily" ? "MMM dd" : timePeriod === "weekly" ? "MMM dd" : timePeriod === "monthly" ? "MMM yyyy" : "yyyy");
      groupedData.set(key, { revenue: 0, customerPayments: 0, voucherSales: 0 });
    });

    // Group transactions by date
    transactions.forEach(transaction => {
      const date = new Date(transaction.createdAt);
      if (date >= startDate && date <= now) {
        const key = format(date, timePeriod === "daily" ? "MMM dd" : timePeriod === "weekly" ? "MMM dd" : timePeriod === "monthly" ? "MMM yyyy" : "yyyy");
        const current = groupedData.get(key) || { revenue: 0, customerPayments: 0, voucherSales: 0 };
        
        current.revenue += transaction.amount;
        if (transaction.transactionType === TransactionType.CUSTOMER_PAYMENT) {
          current.customerPayments += transaction.amount;
        } else if (transaction.transactionType === TransactionType.HOTSPOT_VOUCHER) {
          current.voucherSales += transaction.amount;
        }
        
        groupedData.set(key, current);
      }
    });

    const chartData = Array.from(groupedData.entries()).map(([date, data]) => ({
      date,
      ...data
    }));

    // Calculate statistics
    const totalRevenue = transactions.reduce((sum, t) => sum + t.amount, 0);
    const totalCustomerPayments = transactions
      .filter(t => t.transactionType === TransactionType.CUSTOMER_PAYMENT)
      .reduce((sum, t) => sum + t.amount, 0);
    const totalVoucherSales = transactions
      .filter(t => t.transactionType === TransactionType.HOTSPOT_VOUCHER)
      .reduce((sum, t) => sum + t.amount, 0);
    const averageRevenue = totalRevenue / (intervals.length || 1);

    return {
      chartData,
      stats: {
        totalRevenue,
        totalCustomerPayments,
        totalVoucherSales,
        averageRevenue
      }
    };
  }, [transactions, timePeriod]);

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Revenue Overview</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-[400px] flex items-center justify-center">
            <Loader2 className="h-8 w-8 animate-spin" />
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle>Revenue Overview</CardTitle>
        <TimePeriodSelector value={timePeriod} onChange={setTimePeriod} />
      </CardHeader>
      <CardContent>
        <div className="h-[400px]">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={chartData}>
              <defs>
                <linearGradient id="revenueGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#8884d8" stopOpacity={0.8}/>
                  <stop offset="95%" stopColor="#8884d8" stopOpacity={0.2}/>
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" vertical={false} />
              <XAxis 
                dataKey="date" 
                tick={{ fill: '#666' }}
                axisLine={{ stroke: '#666' }}
              />
              <YAxis 
                tick={{ fill: '#666' }}
                axisLine={{ stroke: '#666' }}
                tickFormatter={(value) => `KES ${value.toLocaleString()}`}
              />
              <Tooltip
                content={({ active, payload }) => {
                  if (active && payload && payload.length) {
                    const data = payload[0].payload;
                    return (
                      <div className="bg-white dark:bg-gray-800 p-4 rounded-lg shadow-lg border">
                        <p className="font-medium">{data.date}</p>
                        <p className="text-sm text-muted-foreground">
                          Revenue: KES {data.revenue.toLocaleString()}
                        </p>
                        <p className="text-sm text-muted-foreground">
                          Customer Payments: KES {data.customerPayments.toLocaleString()}
                        </p>
                        <p className="text-sm text-muted-foreground">
                          Voucher Sales: KES {data.voucherSales.toLocaleString()}
                        </p>
                      </div>
                    );
                  }
                  return null;
                }}
              />
              <Bar 
                dataKey="revenue" 
                fill="url(#revenueGradient)"
                radius={[4, 4, 0, 0]}
              />
            </BarChart>
          </ResponsiveContainer>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-8">
          <div>
            <p className="text-sm font-medium text-muted-foreground">Total Revenue</p>
            <p className="text-2xl font-bold">KES {stats.totalRevenue.toLocaleString()}</p>
          </div>
          <div>
            <p className="text-sm font-medium text-muted-foreground">Customer Payments</p>
            <p className="text-2xl font-bold">KES {stats.totalCustomerPayments.toLocaleString()}</p>
          </div>
          <div>
            <p className="text-sm font-medium text-muted-foreground">Voucher Sales</p>
            <p className="text-2xl font-bold">KES {stats.totalVoucherSales.toLocaleString()}</p>
          </div>
          <div>
            <p className="text-sm font-medium text-muted-foreground">Average Revenue</p>
            <p className="text-2xl font-bold">KES {stats.averageRevenue.toLocaleString()}</p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}