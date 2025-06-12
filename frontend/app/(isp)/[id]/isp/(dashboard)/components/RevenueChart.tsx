"use client";

import { useQuery } from "@apollo/client";
import { GET_ISP_TRANSACTIONS } from "@/graphql/isp_transactions";
import { Loader2, TrendingUp, Info, DollarSign } from "lucide-react";
import { 
  ResponsiveContainer, 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  Tooltip, 
  CartesianGrid,
  TooltipProps,
  Rectangle
} from "recharts";
import { cn } from "@/lib/utils";
import { useTheme } from "next-themes";
import { useState } from "react";
import { ISPTransaction, TransactionType } from "@/types/isp_transaction";
import { format, parseISO, startOfDay, endOfDay, eachDayOfInterval, subDays, subWeeks, subMonths, subYears } from "date-fns";

type TimePeriod = "daily" | "weekly" | "monthly" | "yearly";

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

// Custom bar to remove hover effect
const CustomBar = (props: any) => {
  const { x, y, width, height, fill } = props;
  return <Rectangle x={x} y={y} width={width} height={height} fill={fill} radius={[4, 4, 0, 0]} />;
};

// Time period selector component
const TimePeriodSelector = ({ 
  selectedPeriod,
  onChange
}: { 
  selectedPeriod: TimePeriod, 
  onChange: (period: TimePeriod) => void 
}) => {
  const options: {label: string, value: TimePeriod}[] = [
    { label: "Daily", value: "daily" },
    { label: "Weekly", value: "weekly" },
    { label: "Monthly", value: "monthly" },
    { label: "Yearly", value: "yearly" }
  ];

  return (
    <div className="flex items-center gap-1 rounded-md bg-muted p-1 text-xs">
      {options.map((option) => (
        <button
          key={option.value}
          onClick={() => onChange(option.value)}
          className={cn(
            "px-2 py-1 rounded-sm font-medium transition-all",
            selectedPeriod === option.value 
              ? "bg-background text-foreground shadow-sm" 
              : "text-muted-foreground hover:text-foreground"
          )}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
};

export function RevenueChart({ transactions }: RevenueChartProps) {
  const { theme } = useTheme();
  const isDark = theme === "dark";
  const [timePeriod, setTimePeriod] = useState<TimePeriod>("daily");
  
  if (transactions.length === 0) return <EmptyState />;

  // Get date range based on selected time period
  const now = new Date();
  let startDate: Date;
  switch (timePeriod) {
    case "daily":
      startDate = subDays(now, 7);
      break;
    case "weekly":
      startDate = subWeeks(now, 4);
      break;
    case "monthly":
      startDate = subMonths(now, 6);
      break;
    case "yearly":
      startDate = subYears(now, 1);
      break;
    default:
      startDate = subDays(now, 7);
  }

  // Filter transactions within date range
  const filteredTransactions = transactions.filter(tx => {
    const txDate = parseISO(tx.createdAt);
    return txDate >= startDate && txDate <= now;
  });

  // Group transactions by date and type
  const groupedData = filteredTransactions.reduce((acc, tx) => {
    const date = format(parseISO(tx.createdAt), timePeriod === "daily" ? "MMM dd" : "MMM yyyy");
    if (!acc[date]) {
      acc[date] = {
        date,
        amount: 0,
        customerPayments: 0,
        voucherSales: 0
      };
    }
    acc[date].amount += tx.amount;
    if (tx.transactionType === TransactionType.CUSTOMER_PAYMENT) {
      acc[date].customerPayments += 1;
    } else if (tx.transactionType === TransactionType.HOTSPOT_VOUCHER) {
      acc[date].voucherSales += 1;
    }
    return acc;
  }, {} as Record<string, ChartData>);

  // Convert to array and sort by date
  const data = Object.values(groupedData).sort((a, b) => {
    const dateA = parseISO(a.date);
    const dateB = parseISO(b.date);
    return dateA.getTime() - dateB.getTime();
  });

  // Calculate totals and averages
  const totalRevenue = data.reduce((sum, d) => sum + d.amount, 0);
  const totalCustomerPayments = data.reduce((sum, d) => sum + d.customerPayments, 0);
  const totalVoucherSales = data.reduce((sum, d) => sum + d.voucherSales, 0);
  
  const avgRevenue = data.length > 0 ? totalRevenue / data.length : 0;

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
          <p className="text-xs text-muted-foreground">Average per period</p>
        </div>
      </div>

      <div className="flex justify-end mb-2">
        <TimePeriodSelector selectedPeriod={timePeriod} onChange={setTimePeriod} />
      </div>

      <div className="h-[240px] w-full mt-2">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart
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
            <Bar 
              dataKey="amount" 
              fill="url(#revenueGradient)"
              shape={<CustomBar />}
            />
          </BarChart>
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
          <span>Based on {filteredTransactions.length} transactions</span>
        </div>
      </div>
    </div>
  );
}