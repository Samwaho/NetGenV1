"use client";

import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { useMutation, useQuery } from "@apollo/client";
import { GET_ISP_STATION, UPDATE_ISP_STATION } from "@/graphql/isp_stations";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage, FormDescription } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { useParams, useRouter } from "next/navigation";
import { ArrowLeft, Save, X, MapPin, ShieldAlert } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { LoadingSpinner } from "@/components/ui/loading-spinner";
import { Separator } from "@/components/ui/separator";
import { hasOrganizationPermissions } from "@/lib/permission-utils";
import { OrganizationPermissions } from "@/lib/permissions";
import { useUser } from "@/hooks/useUser";
import { useOrganization } from "@/hooks/useOrganization";

const formSchema = z.object({
  name: z.string().min(2, "Name must be at least 2 characters"),
  description: z.string().optional(),
  location: z.string().min(1, "Location is required"),
  buildingType: z.enum(["APARTMENT", "OFFICE", "SCHOOL", "HOSPITAL", "RESIDENTIAL", "COMMERCIAL", "INDUSTRIAL", "GOVERNMENT", "OTHER"]),
  notes: z.string().optional(),
  coordinates: z.string().optional(),
  status: z.enum(["ACTIVE", "INACTIVE", "MAINTENANCE", "OFFLINE"]),
});

export default function EditStationPage() {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const params = useParams();
  const router = useRouter();
  const organizationId = params.id as string;
  const stationId = params.stationId as string;
  const { user, loading: userLoading } = useUser();
  const { organization, loading: orgLoading } = useOrganization(organizationId);

  const { data, loading: stationLoading, error } = useQuery(GET_ISP_STATION, {
    variables: { id: stationId },
    onError: (error) => {
      toast.error(error.message);
      router.push(`/${organizationId}/isp/stations`);
    },
    fetchPolicy: "network-only"
  });

  const [updateStation] = useMutation(UPDATE_ISP_STATION, {
    refetchQueries: ["GetISPStations"],
    onError: (error) => {
      toast.error(error.message || "Failed to update station");
    }
  });

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      name: "",
      description: "",
      location: "",
      buildingType: "COMMERCIAL" as const,
      notes: "",
      coordinates: "",
      status: "ACTIVE" as const,
    },
  });

  useEffect(() => {
    if (data?.station?.station) {
      const station = data.station.station;
      form.reset({
        name: station.name || "",
        description: station.description || "",
        location: station.location || "",
        buildingType: station.buildingType || "COMMERCIAL",
        notes: station.notes || "",
        coordinates: station.coordinates || "",
        status: station.status || "ACTIVE",
      });
    }
  }, [data]);

  useEffect(() => {
    if (!organizationId || !stationId || organizationId === 'undefined' || stationId === 'undefined') {
      router.push('/');
    }
  }, [organizationId, stationId, router]);

  const isLoading = userLoading || orgLoading || stationLoading;

  const canViewStations = organization && user && hasOrganizationPermissions(
    organization,
    user.id,
    OrganizationPermissions.VIEW_ISP_MANAGER_STATIONS
  );

  const canManageStations = organization && user && hasOrganizationPermissions(
    organization,
    user.id,
    OrganizationPermissions.MANAGE_ISP_MANAGER_STATIONS
  );

  async function onSubmit(values: z.infer<typeof formSchema>) {
    setIsSubmitting(true);
    try {
      await updateStation({
        variables: {
          id: stationId,
          input: values,
        },
      });
      toast.success("Station updated successfully");
      router.push(`/${organizationId}/isp/stations`);
    } catch (error) {
      // Error is handled by mutation onError
    } finally {
      setIsSubmitting(false);
    }
  }

  if (!organizationId || !stationId || organizationId === 'undefined' || stationId === 'undefined') {
    return null;
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <LoadingSpinner />
      </div>
    );
  }

  if (!canViewStations) {
    return (
      <div className="container mx-auto px-4 py-8 text-center">
        <ShieldAlert className="h-16 w-16 text-destructive mx-auto mb-4" />
        <h2 className="text-2xl font-bold text-destructive">Access Denied</h2>
        <p className="text-muted-foreground mt-2">
          You don&apos;t have permission to view stations.
        </p>
      </div>
    );
  }

  if (!canManageStations) {
    return (
      <div className="container mx-auto px-4 py-8 text-center">
        <ShieldAlert className="h-16 w-16 text-destructive mx-auto mb-4" />
        <h2 className="text-2xl font-bold text-destructive">Access Denied</h2>
        <p className="text-muted-foreground mt-2">
          You don&apos;t have permission to edit stations.
        </p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <h2 className="text-lg font-semibold">Error loading station data</h2>
          <p className="text-muted-foreground">{error.message}</p>
          <Button
            variant="outline"
            onClick={() => router.push(`/${organizationId}/isp/stations`)}
            className="mt-4"
          >
            Back to Stations
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="container max-w-4xl mx-auto py-8 px-4">
      <div className="flex items-center gap-4 mb-6">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => router.push(`/${organizationId}/isp/stations`)}
          className="hover:bg-transparent hover:text-primary"
        >
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back to Stations
        </Button>
      </div>

      <div className="flex items-center gap-4 mb-8">
        <MapPin className="h-8 w-8 text-primary" />
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-gradient-custom">Edit Station</h1>
          <p className="text-muted-foreground">Update station information and settings</p>
        </div>
      </div>

      <Card className="mx-auto">
        <CardContent className="p-6">
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8">
              {/* Basic Information Section */}
              <div className="space-y-6">
                <div>
                  <h2 className="text-xl font-semibold">Basic Information</h2>
                  <p className="text-sm text-muted-foreground">Essential details about the station</p>
                </div>
                <Separator />
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <FormField
                    control={form.control}
                    name="name"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Station Name</FormLabel>
                        <FormControl>
                          <Input placeholder="Enter station name" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="location"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Location</FormLabel>
                        <FormControl>
                          <Input placeholder="Enter location" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="buildingType"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Building Type</FormLabel>
                        <Select 
                          onValueChange={field.onChange} 
                          defaultValue={field.value}
                        >
                          <FormControl>
                            <SelectTrigger className="bg-background">
                              <SelectValue defaultValue={field.value}>
                                {field.value?.replace(/_/g, ' ')}
                              </SelectValue>
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {["APARTMENT", "OFFICE", "SCHOOL", "HOSPITAL", "RESIDENTIAL", "COMMERCIAL", "INDUSTRIAL", "GOVERNMENT", "OTHER"].map((type) => (
                              <SelectItem key={type} value={type}>
                                {type.replace(/_/g, ' ')}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="status"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Status</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value}>
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Select status" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {(["ACTIVE", "INACTIVE", "MAINTENANCE", "OFFLINE"] as const).map((status) => (
                              <SelectItem key={status} value={status}>
                                {status.charAt(0) + status.slice(1).toLowerCase()}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
              </div>

              {/* Additional Information Section */}
              <div className="space-y-6">
                <div>
                  <h2 className="text-xl font-semibold">Additional Information</h2>
                  <p className="text-sm text-muted-foreground">Optional details and notes</p>
                </div>
                <Separator />
                <div className="grid grid-cols-1 gap-6">
                  <FormField
                    control={form.control}
                    name="description"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Description</FormLabel>
                        <FormControl>
                          <Textarea 
                            placeholder="Enter station description" 
                            className="min-h-[100px]" 
                            {...field} 
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="coordinates"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Coordinates</FormLabel>
                        <FormControl>
                          <Input placeholder="Enter coordinates (optional)" {...field} />
                        </FormControl>
                        <FormDescription>
                          Format: latitude,longitude (e.g., 40.7128,-74.0060)
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="notes"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Notes</FormLabel>
                        <FormControl>
                          <Textarea 
                            placeholder="Enter additional notes" 
                            className="min-h-[100px]" 
                            {...field} 
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
              </div>

              <div className="flex justify-end space-x-4 pt-6">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => router.push(`/${organizationId}/isp/stations`)}
                  disabled={isSubmitting}
                  className="gap-2"
                >
                  <X className="w-4 h-4" />
                  Cancel
                </Button>
                <Button 
                  type="submit" 
                  disabled={isSubmitting}
                  className="bg-gradient-custom text-white hover:text-white gap-2"
                >
                  {isSubmitting ? (
                    <>
                      <div className="size-4 border-2 border-white/30 border-t-white animate-spin rounded-full" />
                      Saving...
                    </>
                  ) : (
                    <>
                      <Save className="w-4 h-4" />
                      Save Changes
                    </>
                  )}
                </Button>
              </div>
            </form>
          </Form>
        </CardContent>
      </Card>
    </div>
  );
}








