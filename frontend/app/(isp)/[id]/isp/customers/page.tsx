"use client";
import { useQuery } from "@apollo/client";
import { GET_ISP_CUSTOMERS } from "@/graphql/isp_customers";
import { DataTable } from "./components/CustomersTable";
import { columns } from "./components/columns";
import { Button } from "@/components/ui/button";
import { Plus, Users, Wifi, UserCheck, UserX, ShieldAlert } from "lucide-react";
import { toast } from "sonner";
import { ISPCustomersResponse } from "@/types/isp_customer";
import { TableSkeleton } from "@/components/TableSkeleton";
import { useParams } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import Link from "next/link";
import { useUser } from "@/hooks/useUser";
import { useOrganization } from "@/hooks/useOrganization";
import { hasOrganizationPermissions } from "@/lib/permission-utils";
import { OrganizationPermissions } from "@/lib/permissions";

export default function CustomersPage() {
  const params = useParams();
  const organizationId = params.id as string;
  const { user, loading: userLoading } = useUser();
  const { organization, loading: orgLoading } = useOrganization(organizationId);

  const { data, loading: dataLoading, error } = useQuery<ISPCustomersResponse>(
    GET_ISP_CUSTOMERS,
    { 
      variables: { organizationId },
      skip: !organization || !user, // Skip the query until we have user and org data
    }
  );

  // Show loading state while checking permissions
  if (userLoading || orgLoading) {
    return (
      <div className="container mx-auto px-4 py-8 space-y-8">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-bold tracking-tight text-gradient-custom">
              ISP Customers
            </h1>
            <p className="text-muted-foreground">
              Manage your internet service customers
            </p>
          </div>
        </div>
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {[1, 2, 3, 4].map((i) => (
            <Card key={i} className="animate-pulse">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">
                  Loading...
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">--</div>
              </CardContent>
            </Card>
          ))}
        </div>
        <TableSkeleton columns={5} rows={5} />
      </div>
    );
  }

  const canViewCustomers = organization && user && hasOrganizationPermissions(
    organization,
    user.id,
    OrganizationPermissions.VIEW_ISP_MANAGER_CUSTOMERS
  );

  const canManageCustomers = organization && user && hasOrganizationPermissions(
    organization,
    user.id,
    OrganizationPermissions.MANAGE_ISP_MANAGER_CUSTOMERS
  );

  if (!canViewCustomers) {
    return (
      <div className="container mx-auto px-4 py-8 text-center">
        <ShieldAlert className="h-16 w-16 text-red-500 mx-auto mb-4" />
        <h2 className="text-2xl font-bold text-red-500">Access Denied</h2>
        <p className="text-muted-foreground mt-2">
          You don't have permission to view customers.
        </p>
      </div>
    );
  }

  if (error) {
    toast.error("Failed to load customers");
    return (
      <div className="container mx-auto px-4 py-8">
        <p className="text-red-500">
          Failed to load customers. Please try again later.
        </p>
      </div>
    );
  }

  const customers = data?.customers.customers || [];

  // Calculate statistics
  const totalCustomers = customers.length;
  const activeCustomers = customers.filter(customer => customer.status === "ACTIVE").length;
  const onlineCustomers = customers.filter(customer => customer.online).length;
  const inactiveCustomers = totalCustomers - activeCustomers;

  return (
    <div className="container mx-auto px-4 py-8 space-y-8">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-gradient-custom">
            ISP Customers
          </h1>
          <p className="text-muted-foreground">
            Manage your internet service customers
          </p>
        </div>
        {canManageCustomers && (
          <Link href={`/${organizationId}/isp/customers/create`}>
            <Button className="bg-gradient-custom text-white hover:text-white">
              <Plus className="mr-2 h-4 w-4" /> Add Customer
            </Button>
          </Link>
        )}
      </div>

      {dataLoading ? (
        <>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            {[1, 2, 3, 4].map((i) => (
              <Card key={i} className="animate-pulse">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">
                    Loading...
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">--</div>
                </CardContent>
              </Card>
            ))}
          </div>
          <TableSkeleton columns={5} rows={5} />
        </>
      ) : (
        <>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            <Card className="shadow-sm ">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">
                  Total Customers
                </CardTitle>
                <Users className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{totalCustomers}</div>
                <p className="text-xs text-muted-foreground">
                  Registered customers
                </p>
              </CardContent>
            </Card>

            <Card className="shadow-sm ">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">
                  Active Customers
                </CardTitle>
                <UserCheck className="h-4 w-4 text-green-500" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-green-500">
                  {activeCustomers}
                </div>
                <p className="text-xs text-muted-foreground">
                  {totalCustomers > 0 ? `${((activeCustomers / totalCustomers) * 100).toFixed(1)}% of total` : 'No customers'}
                </p>
              </CardContent>
            </Card>

            <Card className="shadow-sm ">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">
                  Online Now
                </CardTitle>
                <Wifi className="h-4 w-4 text-blue-500" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-blue-500">
                  {onlineCustomers}
                </div>
                <p className="text-xs text-muted-foreground">
                  {totalCustomers > 0 ? `${((onlineCustomers / totalCustomers) * 100).toFixed(1)}% of total` : 'No customers'}
                </p>
              </CardContent>
            </Card>

            <Card className="shadow-sm ">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">
                  Inactive Customers
                </CardTitle>
                <UserX className="h-4 w-4 text-red-500" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-red-500">
                  {inactiveCustomers}
                </div>
                <p className="text-xs text-muted-foreground">
                  {totalCustomers > 0 ? `${((inactiveCustomers / totalCustomers) * 100).toFixed(1)}% of total` : 'No customers'}
                </p>
              </CardContent>
            </Card>
          </div>
          <DataTable 
            columns={columns(canManageCustomers)} 
            data={customers} 
          />
        </>
      )}
    </div>
  );
}
