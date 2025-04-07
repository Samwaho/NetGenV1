"use client";
import { useQuery } from "@apollo/client";
import { GET_ISP_INVENTORIES } from "@/graphql/isp_inventory";
import { DataTable } from "./components/InventoryTable";
import { columns } from "./components/columns";
import { Button } from "@/components/ui/button";
import { Plus, Package, ShieldAlert } from "lucide-react";
import { toast } from "sonner";
import { ISPInventoriesResponse, EquipmentStatus } from "@/types/isp_inventory";
import { TableSkeleton } from "@/components/TableSkeleton";
import { useParams, useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useUser } from "@/hooks/useUser";
import { useOrganization } from "@/hooks/useOrganization";
import { hasOrganizationPermissions } from "@/lib/permission-utils";
import { OrganizationPermissions } from "@/lib/permissions";

export default function InventoryPage() {
  const params = useParams();
  const router = useRouter();
  const organizationId = params.id as string;
  const { user, loading: userLoading } = useUser();
  const { organization, loading: orgLoading } = useOrganization(organizationId);

  const { data, loading: dataLoading, error } = useQuery<ISPInventoriesResponse>(
    GET_ISP_INVENTORIES,
    { 
      variables: { organizationId },
      skip: !organization || !user,
    }
  );

  if (userLoading || orgLoading || dataLoading) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="flex justify-between items-center mb-6">
          <div>
            <h1 className="text-2xl font-bold">ISP Inventory</h1>
            <p className="text-muted-foreground">Loading inventory items...</p>
          </div>
        </div>
        <TableSkeleton columns={5} rows={5} />
      </div>
    );
  }

  if (error) {
    toast.error("Failed to load inventory items");
    return null;
  }

  const canViewInventory = organization && user && hasOrganizationPermissions(
    organization,
    user.id,
    OrganizationPermissions.VIEW_ISP_MANAGER_INVENTORY
  );

  const canManageInventory = organization && user && hasOrganizationPermissions(
    organization,
    user.id,
    OrganizationPermissions.MANAGE_ISP_MANAGER_INVENTORY
  );

  if (!canViewInventory) {
    return (
      <div className="container mx-auto px-4 py-8 text-center">
        <ShieldAlert className="h-16 w-16 text-red-500 mx-auto mb-4" />
        <h2 className="text-2xl font-bold text-red-500">Access Denied</h2>
        <p className="text-muted-foreground mt-2">
          You don&apos;t have permission to view inventory.
        </p>
      </div>
    );
  }

  const inventoryItems = data?.inventories?.inventories || [];
  const totalItems = inventoryItems.length;
  const lowStockItems = inventoryItems.filter(item => 
    item.quantity <= (item.quantityThreshold || 0)
  ).length;
  const activeItems = inventoryItems.filter(item => 
    item.status === EquipmentStatus.AVAILABLE
  ).length;

  return (
    <div className="container mx-auto px-2 sm:px-4 py-4 sm:py-8 space-y-4 sm:space-y-8">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-gradient-custom">
            ISP Inventory
          </h1>
          <p className="text-sm sm:text-base text-muted-foreground">
            Manage your equipment and inventory items
          </p>
        </div>
        {canManageInventory && (
          <Button
            onClick={() => router.push(`/${organizationId}/isp/inventory/create`)}
            className="w-full sm:w-auto bg-gradient-custom text-white hover:text-white"
          >
            <Plus className="mr-2 h-4 w-4" /> Add Item
          </Button>
        )}
      </div>

      {inventoryItems.length > 0 ? (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            <Card className="shadow-sm">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-xs sm:text-sm font-medium">
                  Total Items
                </CardTitle>
                <Package className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-xl sm:text-2xl font-bold">
                  {totalItems}
                </div>
              </CardContent>
            </Card>

            <Card className="shadow-sm">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-xs sm:text-sm font-medium">
                  Active Items
                </CardTitle>
                <Package className="h-4 w-4 text-green-500" />
              </CardHeader>
              <CardContent>
                <div className="text-xl sm:text-2xl font-bold text-green-500">
                  {activeItems}
                </div>
                <p className="text-xs text-muted-foreground">
                  {totalItems > 0 ? `${((activeItems / totalItems) * 100).toFixed(1)}% of total` : 'No items'}
                </p>
              </CardContent>
            </Card>

            <Card className="shadow-sm">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-xs sm:text-sm font-medium">
                  Low Stock Items
                </CardTitle>
                <Package className="h-4 w-4 text-red-500" />
              </CardHeader>
              <CardContent>
                <div className="text-xl sm:text-2xl font-bold text-red-500">
                  {lowStockItems}
                </div>
                <p className="text-xs text-muted-foreground">
                  {totalItems > 0 ? `${((lowStockItems / totalItems) * 100).toFixed(1)}% of total` : 'No items'}
                </p>
              </CardContent>
            </Card>
          </div>
          <div className="overflow-x-auto">
            <DataTable 
              columns={columns(canManageInventory)} 
              data={inventoryItems} 
            />
          </div>
        </>
      ) : (
        <div className="text-center py-10">
          <Package className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
          <h3 className="text-lg font-medium">No inventory items</h3>
          <p className="text-muted-foreground">
            Get started by adding your first inventory item.
          </p>
        </div>
      )}
    </div>
  );
}




