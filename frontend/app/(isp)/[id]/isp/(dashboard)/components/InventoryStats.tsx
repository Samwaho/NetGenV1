"use client";

import { Loader2, Package, AlertTriangle, Boxes, CircleDollarSign } from "lucide-react";
import { cn } from "@/lib/utils";

// Define inventory interface based on the GraphQL schema
interface Inventory {
  id: string;
  name: string;
  category: string;
  status: string;
  quantity: number;
  quantityThreshold?: number;
  unitPrice: number;
  createdAt: string;
  updatedAt: string;
}

interface InventoryStatsProps {
  inventories: Inventory[];
}

const LoadingState = () => (
  <div className="flex flex-col items-center justify-center h-[120px]">
    <Loader2 className="h-8 w-8 animate-spin text-primary" />
    <span className="text-sm text-muted-foreground mt-2">Loading inventory...</span>
  </div>
);

const EmptyState = () => (
  <div className="flex flex-col items-center justify-center h-[120px] text-center">
    <div className="p-2 bg-accent rounded-full mb-2">
      <Package className="h-5 w-5 text-accent-foreground" />
    </div>
    <p className="text-sm text-muted-foreground">No inventory items yet</p>
  </div>
);

export function InventoryStats({ inventories }: InventoryStatsProps) {
  if (inventories.length === 0) return <EmptyState />;

  const totalItems = inventories.length;
  
  // Calculate total quantity of all items
  const totalQuantity = inventories.reduce((sum, item) => sum + item.quantity, 0);
  
  // Find items with low stock (below threshold)
  const lowStockItems = inventories.filter(
    item => item.quantity <= (item.quantityThreshold || 0)
  ).length;
  
  // Calculate total inventory value
  const totalValue = inventories.reduce(
    (sum, item) => sum + (item.quantity * item.unitPrice), 0
  );
  
  // Get equipment by category
  const itemsByCategory = inventories.reduce((acc: Record<string, number>, item: Inventory) => {
    const category = item.category || 'Uncategorized';
    acc[category] = (acc[category] || 0) + 1;
    return acc;
  }, {});

  const categoryEntries = Object.entries(itemsByCategory);
  const topCategory = categoryEntries.length > 0 
    ? categoryEntries.sort((a, b) => b[1] - a[1])[0] 
    : null;

  // Calculate items added in the last 30 days
  const today = new Date();
  const lastMonth = new Date(today.getTime() - 30 * 24 * 60 * 60 * 1000);
  const recentItems = inventories.filter(
    item => new Date(item.createdAt) >= lastMonth
  ).length;

  // Calculate percentage of inventory with low stock
  const lowStockPercentage = ((lowStockItems / totalItems) * 100).toFixed(1);

  return (
    <div className="space-y-4">
      <div className="flex flex-col">
        <div className="flex items-center justify-between">
          <div className="text-2xl font-bold text-foreground">
            {totalQuantity}
          </div>
          <div className="flex items-center gap-1 text-chart-4">
            <span className="text-xs font-medium">
              {totalItems} unique items
            </span>
          </div>
        </div>
        <div className="flex items-center justify-between mt-1">
          <div className="flex items-center gap-1.5">
            <div className={cn(
              "h-2 w-2 rounded-full",
              lowStockItems > 0 ? "bg-amber-500" : "bg-green-500"
            )} />
            <span className="text-xs text-muted-foreground">
              {lowStockItems} low stock items
            </span>
          </div>
          <span className="text-xs font-medium text-gradient-custom">
            {lowStockPercentage}%
          </span>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <div className="flex items-center gap-2 p-2 border rounded-lg bg-card">
          <div className="p-1.5 bg-amber-100 rounded-full">
            <AlertTriangle className="h-3.5 w-3.5 text-amber-500" />
          </div>
          <div className="min-w-0">
            <p className="text-xs font-medium text-foreground">Needs Restock</p>
            <p className="text-xs text-muted-foreground truncate">{lowStockItems} items</p>
          </div>
        </div>
        <div className="flex items-center gap-2 p-2 border rounded-lg bg-card">
          <div className="p-1.5 bg-blue-100 rounded-full">
            <Boxes className="h-3.5 w-3.5 text-blue-500" />
          </div>
          <div className="min-w-0">
            <p className="text-xs font-medium text-foreground">New Items</p>
            <p className="text-xs text-muted-foreground truncate">{recentItems} this month</p>
          </div>
        </div>
      </div>

      {topCategory && (
        <div className="pt-3 border-t">
          <div className="flex items-center gap-2">
            <div className="p-1.5 bg-gradient-custom rounded-full">
              <CircleDollarSign className="h-4 w-4 text-white" />
            </div>
            <div className="min-w-0">
              <p className="text-xs text-muted-foreground">Inventory Value</p>
              <p className="text-sm font-medium text-foreground truncate">
                KES {totalValue.toLocaleString()}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 mt-2">
            <div className="min-w-0">
              <p className="text-xs text-muted-foreground">Top Category</p>
              <p className="text-sm font-medium text-foreground truncate">
                {topCategory[0]} ({topCategory[1]} items)
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
