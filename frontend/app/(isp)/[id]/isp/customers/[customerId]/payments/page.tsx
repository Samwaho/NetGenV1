"use client";
import { useQuery } from "@apollo/client";
import { useParams, useRouter } from "next/navigation";
import { GET_CUSTOMER_PAYMENTS } from "@/graphql/isp_customer_payments";
import { GET_ISP_CUSTOMER } from "@/graphql/isp_customers";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Wallet, CreditCard, Receipt, Clock } from "lucide-react";
import { LoadingSpinner } from "@/components/ui/loading-spinner";
import { formatKESCurrency, formatDateToNowInTimezone } from "@/lib/utils";
import { DataTable } from "./components/PaymentsTable";
import { columns } from "./components/columns";
import { memo } from "react";
import { ISPCustomerPayment } from "@/types/isp_customer_payment";
import { ManualPaymentModal } from "@/app/(isp)/[id]/isp/customers/components/ManualPaymentModal";
import { useUser } from "@/hooks/useUser";
import { useOrganization } from "@/hooks/useOrganization";
import { hasOrganizationPermissions } from "@/lib/permission-utils";
import { OrganizationPermissions } from "@/lib/permissions";

// Stats card component
interface StatsCardProps {
  title: string;
  value: string;
  icon: React.ReactNode;
  description: string;
  className?: string;
}

const StatsCard = memo(function StatsCard({
  title,
  value,
  icon,
  description,
  className,
}: StatsCardProps) {
  return (
    <Card className={className}>
      <CardContent className="p-4 sm:p-6">
        <div className="flex items-center justify-between space-x-2 sm:space-x-4 min-w-0 flex-wrap">
          <div className="flex items-center space-x-2 sm:space-x-4 min-w-0">
            {icon}
            <div className="min-w-0">
              <p className="text-xs sm:text-sm font-medium text-muted-foreground truncate">{title}</p>
              <h3 className="text-lg sm:text-2xl font-bold truncate">{value}</h3>
            </div>
          </div>
        </div>
        <p className="text-xs text-muted-foreground mt-2 sm:mt-4 break-words">{description}</p>
      </CardContent>
    </Card>
  );
});

const LoadingState = () => (
  <div className="container mx-auto px-2 sm:px-4 py-4 sm:py-8 space-y-6">
    {/* Header Skeleton */}
    <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
      <div>
        <div className="h-8 w-48 bg-gray-200 dark:bg-gray-700 rounded animate-pulse mb-2" />
        <div className="h-4 w-36 bg-gray-200 dark:bg-gray-700 rounded animate-pulse" />
      </div>
      <div className="h-9 w-36 bg-gray-200 dark:bg-gray-700 rounded animate-pulse" />
    </div>

    {/* Stats Cards Skeleton */}
    <div className="grid gap-4 grid-cols-2 md:grid-cols-2 lg:grid-cols-4">
      {[1, 2, 3, 4].map((i) => (
        <Card key={i} className="animate-pulse">
          <CardContent className="p-6">
            <div className="flex items-center justify-between space-x-4">
              <div className="flex items-center space-x-4">
                <div className="h-4 w-4 bg-gray-200 dark:bg-gray-700 rounded" />
                <div>
                  <div className="h-4 w-24 bg-gray-200 dark:bg-gray-700 rounded mb-2" />
                  <div className="h-6 w-32 bg-gray-200 dark:bg-gray-700 rounded" />
                </div>
              </div>
            </div>
            <div className="h-3 w-36 bg-gray-200 dark:bg-gray-700 rounded mt-4" />
          </CardContent>
        </Card>
      ))}
    </div>

    {/* Table Skeleton */}
    <Card>
      <CardHeader>
        <div className="h-6 w-32 bg-gray-200 dark:bg-gray-700 rounded animate-pulse" />
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          <div className="flex justify-between items-center border-b pb-4">
            {[1, 2, 3, 4, 5, 6, 7].map((i) => (
              <div key={i} className="h-4 w-24 bg-gray-200 dark:bg-gray-700 rounded animate-pulse" />
            ))}
          </div>
          {[1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="flex justify-between items-center py-2">
              {[1, 2, 3, 4, 5, 6, 7].map((j) => (
                <div key={j} className="h-4 w-24 bg-gray-200 dark:bg-gray-700 rounded animate-pulse" />
              ))}
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  </div>
);

export default function CustomerPaymentsPage() {
  const params = useParams();
  const router = useRouter();
  const organizationId = params.id as string;
  const customerId = params.customerId as string;
  const { user, loading: userLoading } = useUser();
  const { organization, loading: orgLoading } = useOrganization(organizationId);

  const { data: customerData, loading: customerLoading } = useQuery(
    GET_ISP_CUSTOMER,
    {
      variables: { id: customerId },
      fetchPolicy: "cache-and-network",
    }
  );

  const { data: paymentsData, loading: paymentsLoading } = useQuery(
    GET_CUSTOMER_PAYMENTS,
    {
      variables: {
        customerId,
        page: 1,
        pageSize: 10,
      },
    }
  );

  if (customerLoading || paymentsLoading || userLoading || orgLoading) {
    return <LoadingState />;
  }

  const customer = customerData?.customer;
  const payments = paymentsData?.customerPayments?.payments || [];

  const canManageCustomers = organization && user && hasOrganizationPermissions(
    organization,
    user.id,
    OrganizationPermissions.MANAGE_ISP_MANAGER_CUSTOMERS
  );

  const stats = {
    totalPaid: payments.reduce(
      (sum: number, payment: ISPCustomerPayment) => sum + payment.amount,
      0
    ),
    totalPayments: payments.length,
    averagePayment: payments.length
      ? payments.reduce(
          (sum: number, payment: ISPCustomerPayment) => sum + payment.amount,
          0
        ) / payments.length
      : 0,
    lastPayment: payments[0]?.paidAt,
  };

  return (
    <div className="container mx-auto px-1 sm:px-4 py-4 sm:py-8 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 sm:gap-4 flex-wrap">
        <div className="min-w-0">
          <h1 className="text-xl sm:text-2xl md:text-3xl font-bold tracking-tight text-gradient-custom truncate">
            Customer Payments
          </h1>
          <p className="text-xs sm:text-sm md:text-base text-muted-foreground truncate">
            {customer.firstName} {customer.lastName} ({customer.username})
          </p>
        </div>
        <div className="flex gap-2 flex-wrap w-full sm:w-auto">
          {canManageCustomers && (
            <ManualPaymentModal 
              customer={customer} 
              onPaymentProcessed={() => {
                // Refetch payments data after successful payment
                window.location.reload();
              }}
            />
          )}
          <Button
            variant="outline"
            onClick={() =>
              router.push(`/${organizationId}/isp/customers`)
            }
            className="gap-2 w-full sm:w-auto"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to Customers
          </Button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid gap-2 sm:gap-4 grid-cols-2 md:grid-cols-2 lg:grid-cols-4">
        <StatsCard
          title="Total Paid"
          value={formatKESCurrency(stats.totalPaid)}
          icon={<Wallet className="h-4 w-4 text-green-500" />}
          description="Total amount paid"
        />
        <StatsCard
          title="Total Payments"
          value={stats.totalPayments.toString()}
          icon={<Receipt className="h-4 w-4 text-blue-500" />}
          description="Number of payments"
        />
        <StatsCard
          title="Average Payment"
          value={formatKESCurrency(stats.averagePayment)}
          icon={<CreditCard className="h-4 w-4 text-purple-500" />}
          description="Average payment amount"
        />
        <StatsCard
          title="Last Payment"
          value={
            stats.lastPayment
              ? formatDateToNowInTimezone(stats.lastPayment)
              : "Never"
          }
          icon={<Clock className="h-4 w-4 text-orange-500" />}
          description="Time since last payment"
        />
      </div>

      {/* Payments Table */}
      <Card>
        <CardHeader>
          <CardTitle className="truncate">Payment History</CardTitle>
        </CardHeader>
        <CardContent>
          {paymentsLoading ? (
            <div className="flex justify-center items-center min-h-[200px]">
              <LoadingSpinner className="w-8 h-8" />
            </div>
          ) : payments.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              No payments found
            </div>
          ) : (
            <div className="overflow-x-auto">
              <DataTable columns={columns} data={payments} />
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
