"use client";

import { useQuery } from "@apollo/client";
import { GET_ISP_CUSTOMERS } from "@/graphql/isp_customers";
import { Loader2, PieChart as PieChartIcon, Info, TrendingUp } from "lucide-react";
import { 
  ResponsiveContainer, 
  PieChart, 
  Pie, 
  Cell, 
  Tooltip,
  Legend,
  TooltipProps
} from "recharts";
import { useTheme } from "next-themes";
import { cn } from "@/lib/utils";

interface ISPCustomer {
  id: string;
  firstName: string;
  lastName: string;
  package: {
    id: string;
    name: string;
  };
}

interface ISPPackage {
  id: string;
  name: string;
}

interface PackageData {
  name: string;
  value: number;
  packageId: string;
  color: string;
}

const COLORS = [
  '#6366F1', // primary (indigo)
  '#8B5CF6', // purple
  '#EC4899', // pink
  '#0EA5E9', // sky
  '#10B981', // emerald
  '#F97316', // orange
  '#14B8A6', // teal
  '#F43F5E', // rose
  '#6366F1', // primary with opacity
  '#8B5CF6', // purple with opacity
].map((color, index) => index > 7 ? `${color}CC` : color);

const LoadingState = () => (
  <div className="flex flex-col items-center justify-center h-[280px] animate-pulse">
    <Loader2 className="h-8 w-8 animate-spin text-primary" />
    <span className="text-sm text-muted-foreground mt-2">Loading package data...</span>
  </div>
);

const EmptyState = () => (
  <div className="flex flex-col items-center justify-center h-[280px] text-center">
    <div className="p-3 bg-accent/50 rounded-full mb-3 transition-colors hover:bg-accent">
      <PieChartIcon className="h-6 w-6 text-accent-foreground" />
    </div>
    <p className="text-sm font-medium text-muted-foreground">No package data available</p>
    <p className="text-xs text-muted-foreground mt-1">Add packages to see distribution</p>
  </div>
);

interface CustomTooltipProps extends TooltipProps<number, string> {
  active?: boolean;
  payload?: Array<{
    name: string;
    value: number;
    payload: PackageData;
  }>;
}

const CustomTooltip = ({ active, payload }: CustomTooltipProps) => {
  if (active && payload && payload.length) {
    const data = payload[0];
    return (
      <div className="bg-card border border-border rounded-lg shadow-lg p-4 text-sm backdrop-blur-sm">
        <p className="font-semibold text-foreground mb-2">{data.name}</p>
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded-full" style={{ backgroundColor: data.payload.color }} />
          <span className="text-foreground font-medium">{data.value}</span>
          <span className="text-muted-foreground text-xs">
            customer{data.value !== 1 ? 's' : ''}
          </span>
        </div>
      </div>
    );
  }
  return null;
};

const CustomLegend = ({ payload }: { payload?: Array<{ value: string; color: string }> }) => {
  if (!payload) return null;
  
  return (
    <ul className="flex flex-wrap gap-x-6 gap-y-3 text-xs justify-center mt-4">
      {payload.map((entry, index) => (
        <li key={`legend-${index}`} className="flex items-center gap-2 transition-opacity hover:opacity-80">
          <div className="w-3 h-3 rounded-full" style={{ backgroundColor: entry.color }} />
          <span className="text-muted-foreground font-medium">{entry.value}</span>
        </li>
      ))}
    </ul>
  );
};

interface PackageChartProps {
  packages: ISPPackage[];
  customers: ISPCustomer[];
}

export function PackageChart({ packages, customers }: PackageChartProps) {
  const { theme } = useTheme();
  const isDark = theme === "dark";
  
  if (customers.length === 0) return <EmptyState />;

  // Count customers by package
  const packageCounts: Record<string, { count: number, name: string, id: string }> = {};
  
  customers.forEach(customer => {
    // Skip if customer has no package
    if (!customer.package?.id) return;
    
    const packageId = customer.package.id;
    const packageName = customer.package.name;
    
    if (!packageCounts[packageId]) {
      packageCounts[packageId] = { count: 0, name: packageName, id: packageId };
    }
    
    packageCounts[packageId].count += 1;
  });

  // Convert to array format for Recharts
  const chartData: PackageData[] = Object.values(packageCounts)
    .sort((a, b) => b.count - a.count) // Sort by count descending
    .map((pkg, index) => ({
      name: pkg.name,
      value: pkg.count,
      packageId: pkg.id,
      color: COLORS[index % COLORS.length] // Cycle through colors
    }));

  // Calculate total customers with packages
  const totalCustomersWithPackages = chartData.reduce((sum, item) => sum + item.value, 0);
  
  // Calculate percentage for most popular package
  const mostPopularPackage = chartData[0] || { name: "None", value: 0 };
  const popularityPercentage = totalCustomersWithPackages > 0 
    ? Math.round((mostPopularPackage.value / totalCustomersWithPackages) * 100) 
    : 0;

  // Calculate growth (comparing to previous period)
  const isGrowing = popularityPercentage > 50; // Example condition, adjust as needed

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-2">
            <h3 className="text-2xl font-bold">{totalCustomersWithPackages}</h3>
            <div className={cn(
              "p-1 rounded-full transition-colors",
              isGrowing ? "bg-green-100/50" : "bg-red-100/50"
            )}>
              <TrendingUp className={cn(
                "h-4 w-4",
                isGrowing ? "text-green-500" : "text-red-500",
                !isGrowing && "transform rotate-180"
              )} />
            </div>
          </div>
          <p className="text-sm text-muted-foreground">
            Total subscribed customers
          </p>
        </div>
        <div className="text-right">
          <p className="text-sm font-medium text-foreground">{mostPopularPackage.name}</p>
          <p className="text-xs text-muted-foreground">
            Most popular • {popularityPercentage}% share
          </p>
        </div>
      </div>

      <div className="h-[280px] w-full mt-4 transition-transform hover:scale-[1.02]">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={chartData}
              cx="50%"
              cy="50%"
              innerRadius="60%"
              outerRadius="80%"
              paddingAngle={4}
              dataKey="value"
              stroke={isDark ? "#1F2937" : "#F8FAFC"}
              strokeWidth={3}
            >
              {chartData.map((entry, index) => (
                <Cell 
                  key={`cell-${index}`} 
                  fill={entry.color}
                  className="transition-opacity hover:opacity-80"
                />
              ))}
            </Pie>
            <Tooltip content={<CustomTooltip />} />
            <Legend content={<CustomLegend />} />
          </PieChart>
        </ResponsiveContainer>
      </div>

      <div className="flex items-center gap-2 text-xs text-muted-foreground justify-end mt-2">
        <Info className="h-3 w-3" />
        <span>Analysis based on {customers.length} active customers</span>
      </div>
    </div>
  );
}
