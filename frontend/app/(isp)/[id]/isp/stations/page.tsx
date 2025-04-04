"use client";

import { useState } from "react";
import { useQuery } from "@apollo/client";
import { GET_ISP_STATIONS } from "@/graphql/isp_stations";
import { DataTable } from "./components/StationsTable";
import { columns } from "./components/columns";
import { Button } from "@/components/ui/button";
import { Plus, Signal, SignalHigh, SignalLow, SignalMedium } from "lucide-react";
import { StationDialog } from "./components/StationDialog";
import { toast } from "sonner";
import { ISPStationsResponse } from "@/types/isp_station";
import { TableSkeleton } from "@/components/TableSkeleton";
import { useParams } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default function StationsPage() {
  const params = useParams();
  const organizationId = params.id as string;
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  
  const { data, loading, error } = useQuery<ISPStationsResponse>(GET_ISP_STATIONS, {
    variables: { organizationId },
  });

  if (error) {
    toast.error("Failed to load stations");
    return (
      <div className="container mx-auto px-4 py-8">
        <p className="text-red-500">Failed to load stations. Please try again later.</p>
      </div>
    );
  }

  const stations = data?.stations.stations || [];
  
  // Calculate statistics
  const totalStations = stations.length;
  const activeStations = stations.filter(station => station.status === "ACTIVE").length;
  const inactiveStations = stations.filter(station => station.status === "INACTIVE").length;
  const maintenanceStations = stations.filter(station => station.status === "MAINTENANCE").length;

  return (
    <div className="container mx-auto px-4 py-8 space-y-8">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-gradient-custom">
            ISP Stations
          </h1>
          <p className="text-muted-foreground">
            Manage and monitor your ISP stations across different locations
          </p>
        </div>
        <Button
          onClick={() => setIsDialogOpen(true)}
          className="bg-gradient-custom text-white hover:text-white"
        >
          <Plus className="mr-2 h-4 w-4" /> Add Station
        </Button>
      </div>

      {loading ? (
        <>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            {[1, 2, 3, 4].map((i) => (
              <Card key={i} className="animate-pulse">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Loading...</CardTitle>
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
                <CardTitle className="text-sm font-medium">Total Stations</CardTitle>
                <Signal className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{totalStations}</div>
                <p className="text-xs text-muted-foreground">
                  Across all locations
                </p>
              </CardContent>
            </Card>
            <Card className="shadow-sm ">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Active Stations</CardTitle>
                <SignalHigh className="h-4 w-4 text-green-500" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-green-500">{activeStations}</div>
                <p className="text-xs text-muted-foreground">
                  {((activeStations / totalStations) * 100).toFixed(1)}% operational
                </p>
              </CardContent>
            </Card>
            <Card className="shadow-sm ">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Inactive Stations</CardTitle>
                <SignalLow className="h-4 w-4 text-red-500" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-red-500">{inactiveStations}</div>
                <p className="text-xs text-muted-foreground">
                  {((inactiveStations / totalStations) * 100).toFixed(1)}% offline
                </p>
              </CardContent>
            </Card>
            <Card className="shadow-sm ">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Under Maintenance</CardTitle>
                <SignalMedium className="h-4 w-4 text-yellow-500" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-yellow-500">{maintenanceStations}</div>
                <p className="text-xs text-muted-foreground">
                  {((maintenanceStations / totalStations) * 100).toFixed(1)}% in maintenance
                </p>
              </CardContent>
            </Card>
          </div>
            <DataTable columns={columns} data={stations} />
        </>
      )}

      <StationDialog 
        open={isDialogOpen} 
        onOpenChange={setIsDialogOpen} 
        organizationId={organizationId as string}
      />
    </div>
  );
}
