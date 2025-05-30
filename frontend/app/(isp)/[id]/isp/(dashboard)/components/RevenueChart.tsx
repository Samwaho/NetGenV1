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

// Time period types
type TimePeriod = "daily" | "weekly" | "monthly" | "yearly";

interface ISPTransaction {
  id: string;
  transactionId: string;
  transactionType: string;
  transTime: string;
  amount: number;
  phoneNumber: string;
  firstName: string;
  lastName: string;
  createdAt: string;
}

interface ChartData {
  name: string;
  revenue: number;
  transactions: number;
}

interface CustomBarProps {
  x?: number;
  y?: number;
  width?: number;
  height?: number;
  fill?: string;
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
          <span>KES {data.revenue.toLocaleString()}</span>
        </div>
        {data.transactions > 0 && (
          <p className="text-xs text-muted-foreground mt-1">
            {data.transactions} transaction{data.transactions !== 1 ? 's' : ''}
          </p>
        )}
      </div>
    );
  }
  return null;
};

// Custom bar to remove hover effect
const CustomBar = (props: CustomBarProps) => {
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
  const [timePeriod, setTimePeriod] = useState<TimePeriod>("monthly");
  
  if (transactions.length === 0) return <EmptyState />;

  // Calculate date ranges based on selected time period
  const now = new Date();
  let startDate = new Date();
  let dataPoints = 0;

  switch (timePeriod) {
    case "daily":
      startDate = new Date(now);
      startDate.setDate(now.getDate() - 13); // Last 14 days
      dataPoints = 14;
      break;
    case "weekly":
      startDate = new Date(now);
      startDate.setDate(now.getDate() - 7 * 9); // Last 10 weeks
      dataPoints = 10;
      break;
    case "monthly":
      startDate = new Date(now);
      startDate.setMonth(now.getMonth() - 5); // Last 6 months
      dataPoints = 6;
      break;
    case "yearly":
      startDate = new Date(now);
      startDate.setFullYear(now.getFullYear() - 4); // Last 5 years
      dataPoints = 5;
      break;
  }

  // Generate all time periods in range for the x-axis
  const timeLabels: string[] = [];
  const tempDate = new Date(startDate);
  
  if (timePeriod === "daily") {
    for (let i = 0; i < dataPoints; i++) {
      const dateStr = new Date(tempDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
      timeLabels.push(dateStr);
      tempDate.setDate(tempDate.getDate() + 1);
    }
  } else if (timePeriod === "weekly") {
    for (let i = 0; i < dataPoints; i++) {
      // Use week number relative to our start date instead of calendar calculation
      const weekNum = i + 1;
      const dateStr = `W${weekNum}, ${tempDate.toLocaleDateString('en-US', { month: 'short' })}`;
      timeLabels.push(dateStr);
      tempDate.setDate(tempDate.getDate() + 7);
    }
  } else if (timePeriod === "monthly") {
    while (tempDate <= now) {
      const monthYearStr = tempDate.toLocaleDateString('en-US', { month: 'short', year: '2-digit' });
      timeLabels.push(monthYearStr);
      tempDate.setMonth(tempDate.getMonth() + 1);
    }
  } else if (timePeriod === "yearly") {
    for (let i = 0; i < dataPoints; i++) {
      const yearStr = tempDate.getFullYear().toString();
      timeLabels.push(yearStr);
      tempDate.setFullYear(tempDate.getFullYear() + 1);
    }
  }

  // Group transactions by time period
  const revenueByTime: Record<string, { revenue: number, transactions: number }> = {};
  
  // Initialize all time periods with zero values
  timeLabels.forEach(label => {
    revenueByTime[label] = { revenue: 0, transactions: 0 };
  });

  // Fill in actual transaction data
  transactions.forEach(tx => {
    const txDate = new Date(tx.createdAt);
    // Skip transactions older than our chart range
    if (txDate < startDate) return;
    
    let timeKey = "";
    
    if (timePeriod === "daily") {
      timeKey = txDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    } else if (timePeriod === "weekly") {
      // Calculate weeks from start date
      const weeksDiff = Math.floor((txDate.getTime() - startDate.getTime()) / (7 * 24 * 60 * 60 * 1000));
      if (weeksDiff >= 0 && weeksDiff < dataPoints) {
        const weekNum = weeksDiff + 1;
        const weekStartDate = new Date(startDate);
        weekStartDate.setDate(startDate.getDate() + (weeksDiff * 7));
        timeKey = `W${weekNum}, ${weekStartDate.toLocaleDateString('en-US', { month: 'short' })}`;
      }
    } else if (timePeriod === "monthly") {
      timeKey = txDate.toLocaleDateString('en-US', { month: 'short', year: '2-digit' });
    } else if (timePeriod === "yearly") {
      timeKey = txDate.getFullYear().toString();
    }
    
    if (revenueByTime[timeKey]) {
      revenueByTime[timeKey].revenue += Number(tx.amount);
      revenueByTime[timeKey].transactions += 1;
    }
  });

  // Convert to array format for Recharts
  const chartData: ChartData[] = timeLabels.map(label => ({
    name: label,
    revenue: revenueByTime[label].revenue,
    transactions: revenueByTime[label].transactions
  }));

  // Calculate total revenue and average revenue
  const totalRevenue = transactions.reduce((sum, tx) => sum + tx.amount, 0);
  
  // Calculate average based on time period
  let avgRevenue = 0;
  if (timeLabels.length > 0) {
    const divisor = timeLabels.length;
    avgRevenue = totalRevenue / divisor;
  }

  // Determine if revenue is trending up or down based on available data
  const lastTwoDataPoints = chartData.filter(data => data.revenue > 0).slice(-2);
  const isTrendingUp = lastTwoDataPoints.length > 1 && 
    lastTwoDataPoints[1].revenue > lastTwoDataPoints[0].revenue;

  // Determine max value for Y-axis domain
  const maxRevenue = Math.max(...chartData.map(data => data.revenue), 10);
  const yAxisMax = maxRevenue < 100 ? 100 : Math.ceil(maxRevenue * 1.2 / 100) * 100;

  const getAverageLabel = () => {
    switch (timePeriod) {
      case "daily": return "Daily average";
      case "weekly": return "Weekly average";
      case "monthly": return "Monthly average";
      case "yearly": return "Yearly average";
    }
  };

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
          <p className="text-xs text-muted-foreground">{getAverageLabel()}</p>
        </div>
      </div>

      <div className="flex justify-end">
        <TimePeriodSelector selectedPeriod={timePeriod} onChange={setTimePeriod} />
      </div>

      <div className="h-[240px] w-full mt-2">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart
            data={chartData}
            margin={{ top: 10, right: 10, left: 0, bottom: 15 }}
            barGap={2}
          >
            <defs>
              <linearGradient id="revenueGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="var(--primary)" stopOpacity={0.8}/>
                <stop offset="95%" stopColor="var(--primary)" stopOpacity={0.6}/>
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={isDark ? "#2D3748" : "#E2E8F0"} opacity={0.5} />
            <XAxis 
              dataKey="name" 
              axisLine={false}
              tickLine={false}
              tick={{ fontSize: 11 }}
              tickMargin={8}
              interval="preserveStartEnd"
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
            <Tooltip 
              content={<CustomTooltip />} 
              cursor={false} 
              wrapperStyle={{ outline: "none" }}
            />
            <Bar 
              dataKey="revenue" 
              fill="url(#revenueGradient)" 
              radius={[4, 4, 0, 0]} 
              barSize={20}
              minPointSize={5}
              isAnimationActive={true}
              name="Revenue"
              shape={<CustomBar />}
            />
          </BarChart>
        </ResponsiveContainer>
      </div>

      <div className="flex items-center gap-1 text-xs text-muted-foreground justify-end">
        <Info className="h-3 w-3" />
        <span>Based on {transactions.length} transactions</span>
      </div>
    </div>
  );
}