"use client";
import { useQuery } from "@apollo/client";
import { GET_ISP_TRANSACTIONS } from "@/graphql/isp_transactions";
import { DataTable } from "./components/TransactionsTable";
import { columns } from "./components/columns";
import { Receipt, CreditCard, TrendingUp, ShieldAlert, Wallet, Wifi } from "lucide-react";
import { toast } from "sonner";
import { ISPTransaction } from "@/types/isp_transaction";
import { TableSkeleton } from "@/components/TableSkeleton";
import { useParams, useSearchParams, useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useUser } from "@/hooks/useUser";
import { useOrganization } from "@/hooks/useOrganization";
import { hasOrganizationPermissions } from "@/lib/permission-utils";
import { OrganizationPermissions } from "@/lib/permissions";
import { useMemo, memo, ReactElement, useState, useCallback, Suspense } from "react";
import { UnmatchedTransactions } from "./components/UnmatchedTransactions";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

// Define filter options interface
interface TransactionFilterOptions {
  page?: number;
  pageSize?: number;
  sortBy?: string;
  sortDirection?: 'asc' | 'desc';
  search?: string;
  transactionType?: string;
}

// Define the props type for StatsCard
interface StatsCardProps {
  title: string;
  value: number | string;
  percentage: string;
  icon: ReactElement;
  color: string;
  isLoading?: boolean;
}

// Update the interface for GraphQL response
interface TransactionsQueryResponse {
  transactions: {
    success: boolean;
    message: string;
    transactions: ISPTransaction[];
    totalCount: number;
  }
}

// Enhanced StatsCard with loading state
const StatsCard = memo(({ 
  title, 
  value, 
  percentage, 
  icon, 
  color, 
  isLoading 
}: StatsCardProps & { isLoading?: boolean }) => (
  <Card className={isLoading ? "animate-pulse" : ""}>
    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
      <CardTitle className="text-sm font-medium">
        {isLoading ? "Loading..." : title}
      </CardTitle>
      {icon}
    </CardHeader>
    <CardContent>
      <div className={`text-2xl font-bold ${color}`}>
        {isLoading ? "--" : value}
      </div>
      <p className="text-xs text-muted-foreground">
        {isLoading ? "Loading..." : percentage}
      </p>
    </CardContent>
  </Card>
));
StatsCard.displayName = "StatsCard";

// Enhanced LoadingState with skeleton animation
const LoadingState = memo(() => (
  <div className="container mx-auto px-4 py-8 space-y-8">
    <div className="flex justify-between items-center">
      <div>
        <div className="h-8 w-48 bg-gray-200 dark:bg-gray-700 rounded animate-pulse mb-2" />
        <div className="h-4 w-36 bg-gray-200 dark:bg-gray-700 rounded animate-pulse" />
      </div>
    </div>
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
      {[1, 2, 3].map((i) => (
        <Card key={i} className="animate-pulse">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <div className="h-4 w-24 bg-gray-200 dark:bg-gray-700 rounded" />
            <div className="h-4 w-4 bg-gray-200 dark:bg-gray-700 rounded" />
          </CardHeader>
          <CardContent>
            <div className="h-8 w-24 bg-gray-200 dark:bg-gray-700 rounded mb-2" />
            <div className="h-3 w-32 bg-gray-200 dark:bg-gray-700 rounded" />
          </CardContent>
        </Card>
      ))}
    </div>
    <TableSkeleton columns={6} rows={5} />
  </div>
));
LoadingState.displayName = "LoadingState";

// Stats section component
const StatsSection = memo(({ stats, isLoading }: { 
  stats: ReturnType<typeof useTransactionStats>, 
  isLoading: boolean 
}) => (
  <div className="grid gap-4 grid-cols-2 md:grid-cols-2 lg:grid-cols-4">
    <StatsCard
      title="Transactions Today"
      value={stats.transactionsToday}
      percentage={`${((stats.transactionsToday / stats.totalTransactions) * 100).toFixed(1)}% of total`}
      icon={<Receipt className="h-4 w-4 text-muted-foreground" />}
      color=""
      isLoading={isLoading}
    />
    <StatsCard
      title="Amount Today"
      value={`KES ${stats.amountToday.toLocaleString()}`}
      percentage={`${((stats.amountToday / stats.totalAmount) * 100).toFixed(1)}% of total`}
      icon={<CreditCard className="h-4 w-4 text-green-500" />}
      color="text-green-500"
      isLoading={isLoading}
    />
    <StatsCard
      title="Voucher Sales"
      value={stats.voucherSales}
      percentage={`${((stats.voucherSales / stats.totalTransactions) * 100).toFixed(1)}% of total`}
      icon={<Wifi className="h-4 w-4 text-blue-500" />}
      color="text-blue-500"
      isLoading={isLoading}
    />
    <StatsCard
      title="Total Amount"
      value={`KES ${stats.totalAmount.toLocaleString()}`}
      percentage="All time payments"
      icon={<Wallet className="h-4 w-4 text-purple-500" />}
      color="text-purple-500"
      isLoading={isLoading}
    />
  </div>
));
StatsSection.displayName = "StatsSection";

// Custom hook for transaction stats
const useTransactionStats = (transactions: ISPTransaction[], totalCount: number) => {
  return useMemo(() => {
    // Get today's date at midnight for comparison
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // Filter transactions for today
    const todayTransactions = transactions.filter(t => {
      const transDate = new Date(t.createdAt);
      return transDate >= today;
    });

    // Calculate total amount for today
    const todayAmount = todayTransactions.reduce((sum, t) => sum + t.amount, 0);

    // Calculate total amount for all transactions
    const totalAmount = transactions.reduce((sum, t) => sum + t.amount, 0);

    // Count voucher sales
    const voucherSales = transactions.filter(t => t.transactionType === "hotspot_voucher").length;

    return {
      totalAmount,
      totalTransactions: totalCount,
      transactionsToday: todayTransactions.length,
      amountToday: todayAmount,
      voucherSales,
      successRate: totalCount ? ((transactions.filter(t => t.status === "completed").length / totalCount) * 100).toFixed(1) : "0",
    };
  }, [transactions, totalCount]);
};

// Access denied component
const AccessDenied = memo(() => (
  <div className="container mx-auto px-4 py-8 text-center">
    <ShieldAlert className="h-16 w-16 text-red-500 mx-auto mb-4" />
    <h2 className="text-2xl font-bold text-red-500">Access Denied</h2>
    <p className="text-muted-foreground mt-2">
      You don&apos;t have permission to view transactions.
    </p>
  </div>
));
AccessDenied.displayName = "AccessDenied";

// Transaction type filter component
const TransactionTypeFilter = memo(({ 
  value, 
  onChange 
}: { 
  value?: string; 
  onChange: (value: string) => void 
}) => (
  <Select value={value || "all"} onValueChange={onChange}>
    <SelectTrigger className="w-[180px]">
      <SelectValue placeholder="All Transactions" />
    </SelectTrigger>
    <SelectContent>
      <SelectItem value="all">All Transactions</SelectItem>
      <SelectItem value="customer_payment">Customer Payments</SelectItem>
      <SelectItem value="hotspot_voucher">Hotspot Vouchers</SelectItem>
    </SelectContent>
  </Select>
));
TransactionTypeFilter.displayName = "TransactionTypeFilter";

export default function TransactionsPage() {
  const params = useParams();
  const searchParams = useSearchParams();
  const router = useRouter();
  const organizationId = params.id as string;
  const { user, loading: userLoading } = useUser();
  const { organization, loading: orgLoading } = useOrganization(organizationId);

  // URL params handling with defaults
  const [filterOptions, setFilterOptions] = useState<TransactionFilterOptions>({
    page: parseInt(searchParams.get("page") || "1"),
    pageSize: parseInt(searchParams.get("pageSize") || "10"),
    sortBy: searchParams.get("sortBy") || "createdAt",
    sortDirection: (searchParams.get("sortDirection") || "desc") as "asc" | "desc",
    search: searchParams.get("search") || undefined,
    transactionType: searchParams.get("transactionType") || "all",
  });

  // Memoized filter change handler
  const handleFilterChange = useCallback((newFilters: TransactionFilterOptions) => {
    setFilterOptions(newFilters);
    const params = new URLSearchParams();
    Object.entries(newFilters).forEach(([key, value]) => {
      if (value) params.set(key, value.toString());
    });
    router.push(`/${organizationId}/isp/transactions?${params.toString()}`);
  }, [organizationId, router]);

  // Check permissions only after data is loaded
  const canViewTransactions = useMemo(() => {
    if (userLoading || orgLoading) return null;
    return organization && user && hasOrganizationPermissions(
      organization,
      user.id,
      OrganizationPermissions.VIEW_MPESA_TRANSACTIONS
    );
  }, [organization, user, userLoading, orgLoading]);

  // GraphQL query with optimized variables
  const { data, loading: dataLoading, error } = useQuery<TransactionsQueryResponse>(
    GET_ISP_TRANSACTIONS,
    {
      variables: {
        organizationId,
        ...filterOptions,
      },
      skip: !organization || !user,
      fetchPolicy: "cache-and-network",
      nextFetchPolicy: "cache-first",
      notifyOnNetworkStatusChange: true,
      onCompleted: (data) => {
        if (!data?.transactions?.success) {
          toast.error(data?.transactions?.message || 'Failed to load transactions');
        }
      },
      onError: (error) => {
        toast.error(`Error loading transactions: ${error.message}`);
      }
    }
  );

  const transactions = data?.transactions.transactions || [];
  const totalCount = data?.transactions.totalCount || 0;
  const stats = useTransactionStats(transactions, totalCount);

  // Show loading state while checking permissions
  if (userLoading || orgLoading) {
    return <LoadingState />;
  }

  // Show access denied only after we're sure about permissions
  if (canViewTransactions === false) {
    return <AccessDenied />;
  }

  if (error) {
    toast.error("Failed to load transactions");
    return null;
  }

  return (
    <div className="container mx-auto px-2 sm:px-4 py-4 sm:py-8 space-y-4 sm:space-y-8">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-gradient-custom">
            ISP Transactions
          </h1>
          <p className="text-sm sm:text-base text-muted-foreground">
            View and manage payment transactions
          </p>
        </div>
        <TransactionTypeFilter 
          value={filterOptions.transactionType} 
          onChange={(value) => handleFilterChange({ ...filterOptions, transactionType: value })}
        />
      </div>

      <Suspense fallback={<StatsSection stats={stats} isLoading={true} />}>
        <StatsSection stats={stats} isLoading={dataLoading && !data} />
      </Suspense>

      <Tabs defaultValue="all" className="space-y-4">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="all">All Transactions</TabsTrigger>
          <TabsTrigger value="unmatched">Unmatched Transactions</TabsTrigger>
        </TabsList>
        
        <TabsContent value="all" className="space-y-4">
          <div className="overflow-x-auto p-2 sm:p-4 bg-card rounded-2xl shadow-md dark:border">
            <Suspense fallback={<TableSkeleton columns={6} rows={5} />}>
              <DataTable 
                columns={columns} 
                data={transactions}
                totalCount={totalCount}
                filterOptions={filterOptions}
                onFilterChange={handleFilterChange}
                isLoading={dataLoading}
              />
            </Suspense>
          </div>
        </TabsContent>

        <TabsContent value="unmatched" className="space-y-4">
          <div className="overflow-x-auto p-2 sm:p-4 bg-card rounded-2xl shadow-md dark:border">
            <Suspense fallback={<TableSkeleton columns={6} rows={5} />}>
              <UnmatchedTransactions organizationId={params.id as string} />
            </Suspense>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
