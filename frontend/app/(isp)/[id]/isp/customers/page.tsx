"use client";
import { useState } from "react";
import { useQuery } from "@apollo/client";
import { GET_ISP_CUSTOMERS } from "@/graphql/isp_customers";
import { DataTable } from "./components/CustomersTable";
import { columns } from "./components/columns";
import { Button } from "@/components/ui/button";
import { Plus, Users, Wifi, UserCheck, UserX } from "lucide-react";
import { CustomerDialog } from "./components/CustomerDialog";
import { toast } from "sonner";
import { ISPCustomersResponse } from "@/types/isp_customer";
import { TableSkeleton } from "@/components/TableSkeleton";
import { useParams } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default function CustomersPage() {
  const params = useParams();
  const organizationId = params.id as string;
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const { data, loading, error } = useQuery<ISPCustomersResponse>(
    GET_ISP_CUSTOMERS,
    { variables: { organizationId } }
  );

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
        <Button
          onClick={() => setIsDialogOpen(true)}
          className="bg-gradient-custom text-white hover:text-white"
        >
          <Plus className="mr-2 h-4 w-4" /> Add Customer
        </Button>
      </div>

      {loading ? (
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
            <Card className="shadow-sm dark:shadow-purple-500/20">
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

            <Card className="shadow-sm dark:shadow-purple-500/20">
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

            <Card className="shadow-sm dark:shadow-purple-500/20">
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

            <Card className="shadow-sm dark:shadow-purple-500/20">
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
          <DataTable columns={columns} data={customers} />
        </>
      )}
      <CustomerDialog
        open={isDialogOpen}
        onOpenChange={setIsDialogOpen}
        organizationId={organizationId}
      />
    </div>
  );
}
