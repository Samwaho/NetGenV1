"use client";

import { useQuery } from "@apollo/client";
import { GET_ISP_TRANSACTIONS } from "@/graphql/isp_transactions";
import { Loader2, TrendingUp, Info, DollarSign } from "lucide-react";
import { 
  ResponsiveContainer, 
  LineChart, 
  Line, 
  XAxis, 
  YAxis, 
  Tooltip, 
  CartesianGrid,
  TooltipProps
} from "recharts";
import { cn } from "@/lib/utils";
import { useTheme } from "next-themes";
import { useState } from "react";
import { ISPTransaction, TransactionType } from "@/types/isp_transaction";
import { format, parseISO, startOfDay, endOfDay, eachDayOfInterval } from "date-fns";

interface ChartData {
  date: string;
  amount: number;
  customerPayments: number;
  voucherSales: number;
}

interface RevenueChartProps {
  transactions: ISPTransaction[];
}

const LoadingState = () => (
  <div className="flex flex-col items-center justify-center h-[280px]">
    <Loader2 className="h-8 w-8 animate-spin text-primary" />
    <span className="text-sm text-muted-foreground mt-2">Loading transaction data...</span>
  </div>
);

const EmptyState = () => (
  <div className="flex flex-col items-center justify-center h-[280px] text-center">
    <div className="p-2 bg-accent rounded-full mb-2">
      <DollarSign className="h-5 w-5 text-accent-foreground" />
    </div>
    <p className="text-sm text-muted-foreground">No transaction data available</p>
  </div>
);

interface CustomTooltipProps extends TooltipProps<number, string> {
  active?: boolean;
  payload?: Array<{
    value: number;
    payload: ChartData;
  }>;
  label?: string;
}

const CustomTooltip = ({ active, payload, label }: CustomTooltipProps) => {
  if (active && payload && payload.length) {
    const data = payload[0].payload as ChartData;
    return (
      <div className="bg-card border border-border rounded-lg shadow-md p-3 text-sm">
        <p className="font-semibold text-foreground mb-1">{label}</p>
        <div className="flex items-center gap-1 text-primary font-medium">
          <span>KES {data.amount.toLocaleString()}</span>
        </div>
        <div className="text-xs text-muted-foreground mt-1 space-y-1">
          <p>Customer Payments: {data.customerPayments}</p>
          <p>Voucher Sales: {data.voucherSales}</p>
        </div>
      </div>
    );
  }
  return null;
};

export function RevenueChart({ transactions }: RevenueChartProps) {
  const { theme } = useTheme();
  const isDark = theme === "dark";
  
  if (transactions.length === 0) return <EmptyState />;

  // Get date range from transactions
  const dates = transactions.map(tx => parseISO(tx.createdAt));
  const startDate = startOfDay(new Date(Math.min(...dates.map(d => d.getTime()))));
  const endDate = endOfDay(new Date(Math.max(...dates.map(d => d.getTime()))));

  // Create array of all days in range
  const days = eachDayOfInterval({ start: startDate, end: endDate });

  // Initialize data structure with all days
  const dailyData = days.reduce((acc, day) => {
    const dateStr = format(day, "MMM dd");
    acc[dateStr] = {
      date: dateStr,
      amount: 0,
      customerPayments: 0,
      voucherSales: 0
    };
    return acc;
  }, {} as Record<string, ChartData>);

  // Group transactions by date and type
  transactions.forEach(transaction => {
    const date = format(parseISO(transaction.createdAt), "MMM dd");
    if (dailyData[date]) {
      dailyData[date].amount += transaction.amount;
      if (transaction.transactionType === TransactionType.CUSTOMER_PAYMENT) {
        dailyData[date].customerPayments += 1;
      } else if (transaction.transactionType === TransactionType.HOTSPOT_VOUCHER) {
        dailyData[date].voucherSales += 1;
      }
    }
  });

  // Convert to array and sort by date
  const data = Object.values(dailyData).sort((a, b) => {
    const dateA = parseISO(a.date);
    const dateB = parseISO(b.date);
    return dateA.getTime() - dateB.getTime();
  });

  // Calculate total revenue and transaction counts
  const totalRevenue = transactions.reduce((sum, tx) => sum + tx.amount, 0);
  const totalCustomerPayments = transactions.filter(tx => tx.transactionType === TransactionType.CUSTOMER_PAYMENT).length;
  const totalVoucherSales = transactions.filter(tx => tx.transactionType === TransactionType.HOTSPOT_VOUCHER).length;
  
  // Calculate averages
  const avgRevenue = data.length > 0 ? totalRevenue / data.length : 0;
  const avgCustomerPayments = data.length > 0 ? totalCustomerPayments / data.length : 0;
  const avgVoucherSales = data.length > 0 ? totalVoucherSales / data.length : 0;

  // Determine if revenue is trending up or down
  const lastTwoDataPoints = data.filter(d => d.amount > 0).slice(-2);
  const isTrendingUp = lastTwoDataPoints.length > 1 && 
    lastTwoDataPoints[1].amount > lastTwoDataPoints[0].amount;

  // Determine max value for Y-axis domain
  const maxRevenue = Math.max(...data.map(d => d.amount), 10);
  const yAxisMax = maxRevenue < 100 ? 100 : Math.ceil(maxRevenue * 1.2 / 100) * 100;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-1">
            <h3 className="text-2xl font-bold">KES {totalRevenue.toLocaleString()}</h3>
            <div className={cn(
              "p-1 rounded-full", 
              isTrendingUp ? "bg-green-100" : "bg-red-100"
            )}>
              <TrendingUp className={cn(
                "h-3 w-3", 
                isTrendingUp ? "text-green-500" : "text-red-500",
                !isTrendingUp && "transform rotate-180"
              )} />
            </div>
          </div>
          <p className="text-xs text-muted-foreground">
            {isTrendingUp ? "Increasing" : "Decreasing"} revenue
          </p>
        </div>
        <div className="text-right">
          <p className="text-sm font-medium">KES {avgRevenue.toLocaleString()}</p>
          <p className="text-xs text-muted-foreground">Daily average</p>
        </div>
      </div>

      <div className="h-[240px] w-full mt-2">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart
            data={data}
            margin={{ top: 10, right: 10, left: 0, bottom: 15 }}
          >
            <defs>
              <linearGradient id="revenueGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="var(--primary)" stopOpacity={0.8}/>
                <stop offset="95%" stopColor="var(--primary)" stopOpacity={0.6}/>
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={isDark ? "#2D3748" : "#E2E8F0"} opacity={0.5} />
            <XAxis 
              dataKey="date" 
              axisLine={false}
              tickLine={false}
              tick={{ fontSize: 11 }}
              tickMargin={8}
            />
            <YAxis 
              axisLine={false}
              tickLine={false}
              tick={{ fontSize: 11 }}
              tickFormatter={(value) => {
                if (value >= 1000) {
                  return `${(value / 1000).toFixed(1)}k`;
                }
                return `${value}`;
              }}
              width={35}
              domain={[0, yAxisMax]}
            />
            <Tooltip content={<CustomTooltip />} />
            <Line 
              type="monotone"
              dataKey="amount" 
              stroke="url(#revenueGradient)" 
              strokeWidth={2}
              dot={false}
              activeDot={{ r: 8 }}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>

      <div className="flex items-center justify-between text-xs text-muted-foreground">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-1">
            <span>Customer Payments:</span>
            <span className="font-medium">{totalCustomerPayments}</span>
          </div>
          <div className="flex items-center gap-1">
            <span>Voucher Sales:</span>
            <span className="font-medium">{totalVoucherSales}</span>
          </div>
        </div>
        <div className="flex items-center gap-1">
          <Info className="h-3 w-3" />
          <span>Based on {transactions.length} transactions</span>
        </div>
      </div>
    </div>
  );
}