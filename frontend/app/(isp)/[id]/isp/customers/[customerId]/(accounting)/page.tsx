"use client";

import { useQuery } from "@apollo/client";
import { useParams, useRouter } from "next/navigation";
import { GET_CUSTOMER_ACCOUNTINGS } from "@/graphql/isp_customers_accounting";
import { GET_ISP_CUSTOMER } from "@/graphql/isp_customers";
import { CustomerAccountingsResponse } from "@/types/isp_customer_accounting";
import { CustomerResponse } from "@/types/isp_customer";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { 
  ArrowLeft, 
  Clock, 
  Download, 
  Upload, 
  Activity,
  Wifi,
  Signal,
  Timer
} from "lucide-react";
import { LoadingSpinner } from "@/components/ui/loading-spinner";
import { formatBytes, formatDuration } from "@/lib/utils";
import { format } from "date-fns";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";

interface StatsCardProps {
  title: string;
  value: string;
  icon: React.ReactNode;
  description: string;
  className?: string;
}

const StatsCard = ({ title, value, icon, description, className = "" }: StatsCardProps) => (
  <Card className={className}>
    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
      <CardTitle className="text-sm font-medium">
        {title}
      </CardTitle>
      {icon}
    </CardHeader>
    <CardContent>
      <div className="text-2xl font-bold">{value}</div>
      <p className="text-xs text-muted-foreground">
        {description}
      </p>
    </CardContent>
  </Card>
);

const StatusBadge = ({ status }: { status: string }) => {
  let variant = "default";
  switch (status) {
    case "Start":
      variant = "success";
      break;
    case "Stop":
      variant = "destructive";
      break;
    case "Interim-Update":
      variant = "secondary";
      break;
  }
  return <Badge variant={variant as any}>{status}</Badge>;
};

export default function CustomerAccountingPage() {
  const params = useParams();
  const router = useRouter();
  const organizationId = params.id as string;
  const customerId = params.customerId as string;

  const { data: customerData, loading: customerLoading } = useQuery<CustomerResponse>(
    GET_ISP_CUSTOMER,
    {
      variables: { id: customerId },
      fetchPolicy: "cache-and-network",
    }
  );

  const { data: accountingData, loading: accountingLoading } = useQuery<CustomerAccountingsResponse>(
    GET_CUSTOMER_ACCOUNTINGS,
    {
      variables: {
        customerId,
        page: 1,
        pageSize: 50
      },
      pollInterval: 30000,
    }
  );

  if (customerLoading || accountingLoading) {
    return <LoadingSpinner />;
  }

  const customer = customerData?.customer;
  const latestSession = accountingData?.customerAccountings?.accountings?.[0] || null;

  if (!customer) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="text-center">
          <h2 className="text-2xl font-bold">Customer not found</h2>
          <Button
            className="mt-4"
            onClick={() => router.push(`/${organizationId}/isp/customers`)}
          >
            Back to Customers
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-2 sm:px-4 py-4 sm:py-8 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-gradient-custom">
            Customer Usage
          </h1>
          <p className="text-sm sm:text-base text-muted-foreground">
            {customer.firstName} {customer.lastName} ({customer.username})
          </p>
        </div>
        <Button
          variant="outline"
          onClick={() => router.push(`/${organizationId}/isp/customers`)}
          className="gap-2"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to Customers
        </Button>
      </div>

      {/* Current Session Stats */}
      <div className="grid gap-4 grid-cols-2 md:grid-cols-2 lg:grid-cols-4">
        <StatsCard
          title="Session Time"
          value={formatDuration(latestSession?.sessionTime ?? 0)}
          icon={<Clock className="h-4 w-4 text-muted-foreground" />}
          description="Current session duration"
        />
        <StatsCard
          title="Download"
          value={formatBytes(latestSession?.totalInputBytes ?? 0)}
          icon={<Download className="h-4 w-4 text-green-500" />}
          description="Total downloaded data"
        />
        <StatsCard
          title="Upload"
          value={formatBytes(latestSession?.totalOutputBytes ?? 0)}
          icon={<Upload className="h-4 w-4 text-blue-500" />}
          description="Total uploaded data"
        />
        <StatsCard
          title="Total Traffic"
          value={formatBytes((latestSession?.totalInputBytes ?? 0) + (latestSession?.totalOutputBytes ?? 0))}
          icon={<Activity className="h-4 w-4 text-purple-500" />}
          description="Combined traffic"
        />
      </div>

      {/* Session Details */}
      {latestSession && (
        <Card className="overflow-hidden">
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>Current Session Details</CardTitle>
              <StatusBadge status={latestSession.status} />
            </div>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Connection Details */}
            <div className="space-y-4">
              <h3 className="font-semibold flex items-center gap-2">
                <Wifi className="h-4 w-4" />
                Connection Information
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                <div className="space-y-1">
                  <p className="text-sm text-muted-foreground">IP Address</p>
                  <p className="font-medium">{latestSession.framedIpAddress}</p>
                </div>
                <div className="space-y-1">
                  <p className="text-sm text-muted-foreground">MAC Address</p>
                  <p className="font-medium">{latestSession.callingStationId}</p>
                </div>
                <div className="space-y-1">
                  <p className="text-sm text-muted-foreground">Rate Limit</p>
                  <p className="font-medium">{latestSession.mikrotikRateLimit}</p>
                </div>
              </div>
            </div>

            <Separator />

            {/* Session Timing */}
            <div className="space-y-4">
              <h3 className="font-semibold flex items-center gap-2">
                <Timer className="h-4 w-4" />
                Session Timing
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                <div className="space-y-1">
                  <p className="text-sm text-muted-foreground">Start Time</p>
                  <p className="font-medium">
                    {latestSession.startTime ? format(new Date(latestSession.startTime), 'PPp') : 'N/A'}
                  </p>
                </div>
                <div className="space-y-1">
                  <p className="text-sm text-muted-foreground">Last Update</p>
                  <p className="font-medium">
                    {latestSession.lastUpdate ? format(new Date(latestSession.lastUpdate), 'PPp') : 'N/A'}
                  </p>
                </div>
                <div className="space-y-1">
                  <p className="text-sm text-muted-foreground">Session ID</p>
                  <p className="font-medium">{latestSession.sessionId}</p>
                </div>
              </div>
            </div>

            <Separator />

            {/* Network Details */}
            <div className="space-y-4">
              <h3 className="font-semibold flex items-center gap-2">
                <Signal className="h-4 w-4" />
                Network Details
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                <div className="space-y-1">
                  <p className="text-sm text-muted-foreground">NAS Identifier</p>
                  <p className="font-medium">{latestSession.nasIdentifier}</p>
                </div>
                <div className="space-y-1">
                  <p className="text-sm text-muted-foreground">NAS IP Address</p>
                  <p className="font-medium">{latestSession.nasIpAddress}</p>
                </div>
                <div className="space-y-1">
                  <p className="text-sm text-muted-foreground">NAS Port</p>
                  <p className="font-medium">{latestSession.nasPort}</p>
                </div>
                <div className="space-y-1">
                  <p className="text-sm text-muted-foreground">Service Type</p>
                  <p className="font-medium">{latestSession.serviceType}</p>
                </div>
                <div className="space-y-1">
                  <p className="text-sm text-muted-foreground">Port Type</p>
                  <p className="font-medium">{latestSession.nasPortType}</p>
                </div>
                <div className="space-y-1">
                  <p className="text-sm text-muted-foreground">Called Station ID</p>
                  <p className="font-medium">{latestSession.calledStationId}</p>
                </div>
              </div>
            </div>

            {/* Delta Information */}
            <Separator />
            <div className="space-y-4">
              <h3 className="font-semibold flex items-center gap-2">
                <Activity className="h-4 w-4" />
                Session Changes
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                <div className="space-y-1">
                  <p className="text-sm text-muted-foreground">Delta Download</p>
                  <p className="font-medium">{formatBytes(latestSession.deltaInputBytes ?? 0)}</p>
                </div>
                <div className="space-y-1">
                  <p className="text-sm text-muted-foreground">Delta Upload</p>
                  <p className="font-medium">{formatBytes(latestSession.deltaOutputBytes ?? 0)}</p>
                </div>
                <div className="space-y-1">
                  <p className="text-sm text-muted-foreground">Delta Time</p>
                  <p className="font-medium">{formatDuration(latestSession.deltaSessionTime ?? 0)}</p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}





