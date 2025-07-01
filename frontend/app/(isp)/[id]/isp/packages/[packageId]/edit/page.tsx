"use client";

import { useEffect, useState, useMemo, useCallback } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { useMutation, useQuery } from "@apollo/client";
import { GET_ISP_PACKAGE, UPDATE_ISP_PACKAGE } from "@/graphql/isp_packages";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { useParams, useRouter } from "next/navigation";
import { ArrowLeft, Loader2, Package2, ShieldAlert } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { useUser } from "@/hooks/useUser";
import { useOrganization } from "@/hooks/useOrganization";
import { OrganizationPermissions } from "@/lib/permissions";
import { LoadingSpinner } from "@/components/ui/loading-spinner";
import { hasOrganizationPermissions } from "@/lib/permission-utils";
import { Checkbox } from "@/components/ui/checkbox";

// Memoize form schema
const formSchema = z.object({
  name: z.string().min(2, "Name must be at least 2 characters"),
  description: z.string().optional(),
  serviceType: z.enum(["PPPOE", "HOTSPOT", "STATIC", "DHCP"]),
  downloadSpeed: z.number().min(0, "Download speed must be positive"),
  uploadSpeed: z.number().min(0, "Upload speed must be positive"),
  burstDownload: z.number().optional(),
  burstUpload: z.number().optional(),
  thresholdDownload: z.number().optional(),
  thresholdUpload: z.number().optional(),
  burstTime: z.number().optional(),
  addressPool: z.string().optional(),
  price: z.number().min(0, "Price must be positive"),
  // Session management
  sessionTimeout: z.number().optional(),
  idleTimeout: z.number().optional(),
  // QoS and VLAN
  priority: z.number().optional(),
  vlanId: z.number().optional(),
  // Hotspot specific fields
  showInHotspot: z.boolean().optional(),
  duration: z.number().optional(),
  durationUnit: z.string().optional(),
  dataLimit: z.number().optional(),
  dataLimitUnit: z.string().optional(),
});

export default function EditPackagePage() {
  // State and hooks
  const [isSubmitting, setIsSubmitting] = useState(false);
  const params = useParams();
  const router = useRouter();
  const organizationId = useMemo(() => params.id as string, [params.id]);
  const packageId = useMemo(() => params.packageId as string, [params.packageId]);
  const { user, loading: userLoading } = useUser();
  const { organization, loading: orgLoading } = useOrganization(organizationId);

  // Memoize navigation handler
  const navigateBack = useCallback((refresh = false) => {
    if (refresh) {
      router.push(`/${organizationId}/isp/packages?refresh=1`);
    } else {
      router.push(`/${organizationId}/isp/packages`);
    }
  }, [router, organizationId]);

  // Query package data with optimized caching
  const { data, loading: packageLoading, error } = useQuery(GET_ISP_PACKAGE, {
    variables: { id: packageId },
    onError: (error) => {
      toast.error(error.message);
      navigateBack();
    },
    fetchPolicy: "network-only",
    nextFetchPolicy: "cache-first"
  });

  // Configure mutation with optimized caching
  const [updatePackage] = useMutation(UPDATE_ISP_PACKAGE, {
    refetchQueries: [
      {
        query: require("@/graphql/isp_packages").GET_ISP_PACKAGES,
        variables: { organizationId },
      },
    ],
    onError: (error) => {
      toast.error(error.message || "Failed to update package");
      setIsSubmitting(false);
    },
    onCompleted: () => {
      toast.success("Package updated successfully");
      navigateBack(true);
      setIsSubmitting(false);
    },
    fetchPolicy: "no-cache"
  });

  // Memoize default form values
  const defaultValues = useMemo(() => ({
    name: "",
    description: "",
    serviceType: "PPPOE" as "PPPOE" | "HOTSPOT" | "STATIC" | "DHCP",
    downloadSpeed: 0,
    uploadSpeed: 0,
    burstDownload: undefined,
    burstUpload: undefined,
    thresholdDownload: undefined,
    thresholdUpload: undefined,
    burstTime: undefined,
    addressPool: "",
    price: 0,
    // Session management
    sessionTimeout: undefined,
    idleTimeout: undefined,
    // QoS and VLAN
    priority: undefined,
    vlanId: undefined,
    // Hotspot specific fields
    showInHotspot: false,
    duration: undefined,
    durationUnit: "days",
    dataLimit: undefined,
    dataLimitUnit: "MB",
  }), []);

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues,
  });

  // Update form when data is loaded
  useEffect(() => {
    if (data?.package.package) {
      const pkg = data.package.package;
      form.reset({
        name: pkg.name || "",
        description: pkg.description || "",
        serviceType: pkg.serviceType || "PPPOE",
        downloadSpeed: pkg.downloadSpeed || 0,
        uploadSpeed: pkg.uploadSpeed || 0,
        burstDownload: pkg.burstDownload ?? undefined,
        burstUpload: pkg.burstUpload ?? undefined,
        thresholdDownload: pkg.thresholdDownload ?? undefined,
        thresholdUpload: pkg.thresholdUpload ?? undefined,
        burstTime: pkg.burstTime ?? undefined,
        addressPool: pkg.addressPool || "",
        price: pkg.price || 0,
        // Session management
        sessionTimeout: pkg.sessionTimeout ?? undefined,
        idleTimeout: pkg.idleTimeout ?? undefined,
        // QoS and VLAN
        priority: pkg.priority ?? undefined,
        vlanId: pkg.vlanId ?? undefined,
        // Hotspot specific fields
        showInHotspot: pkg.showInHotspot ?? false,
        duration: pkg.duration ?? undefined,
        durationUnit: pkg.durationUnit || "days",
        dataLimit: pkg.dataLimit ?? undefined,
        dataLimitUnit: pkg.dataLimitUnit || "MB",
      });
    }
  }, [data, form]);

  const isLoading = userLoading || orgLoading || packageLoading;

  // Memoize permissions check to avoid recalculation
  const canManagePackages = useMemo(() => (
    organization && user && hasOrganizationPermissions(
      organization,
      user.id,
      OrganizationPermissions.MANAGE_ISP_MANAGER_PACKAGES
    )
  ), [organization, user]);

  // Memoize submit handler to prevent recreating on each render
  const onSubmit = useCallback(async (values: z.infer<typeof formSchema>) => {
    setIsSubmitting(true);
    try {
      await updatePackage({
        variables: {
          id: packageId,
          input: values,
        },
      });
      // Success handling moved to mutation onCompleted
    } catch {
      // Error handling moved to mutation onError
    }
  }, [updatePackage, packageId]);

  if (!canManagePackages) {
    return (
      <div className="container mx-auto px-4 py-8 text-center">
        <ShieldAlert className="h-16 w-16 text-destructive mx-auto mb-4" />
        <h2 className="text-2xl font-bold text-destructive">Access Denied</h2>
        <p className="text-muted-foreground mt-2">
          You don&apos;t have permission to edit packages.
        </p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <h2 className="text-lg font-semibold">Error loading package data</h2>
          <p className="text-muted-foreground">{error.message}</p>
          <Button
            variant="outline"
            onClick={() => navigateBack()}
            className="mt-4"
          >
            Back to Packages
          </Button>
        </div>
      </div>
    );
  }

  if (isLoading) {
    return <LoadingSpinner />;
  }

  return (
    <div className="container mx-auto py-8 max-w-3xl">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-gradient-custom">Edit Package</h1>
          <p className="text-muted-foreground mt-1">
            Update package information and settings
          </p>
        </div>
        <Button
          variant="outline"
          onClick={() => navigateBack()}
          className="gap-2"
        >
          <ArrowLeft className="size-4" />
          Back to Packages
        </Button>
      </div>

      <Card>
        <CardContent className="pt-6">
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8">
              {/* Basic Information Section */}
              <div className="space-y-6">
                <div>
                  <h2 className="text-xl font-semibold">Basic Information</h2>
                  <p className="text-sm text-muted-foreground">Essential details about the package</p>
                </div>
                <Separator />
                <div className="grid grid-cols-1 gap-6">
                  <FormField
                    control={form.control}
                    name="name"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Package Name</FormLabel>
                        <FormControl>
                          <Input placeholder="Enter package name" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="description"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Description</FormLabel>
                        <FormControl>
                          <Textarea placeholder="Enter package description" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
              </div>

              {/* Service Configuration Section */}
              <div className="space-y-6">
                <div>
                  <h2 className="text-xl font-semibold">Service Configuration</h2>
                  <p className="text-sm text-muted-foreground">Configure service settings and speeds</p>
                </div>
                <Separator />
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <FormField
                    control={form.control}
                    name="serviceType"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Service Type</FormLabel>
                        <Select onValueChange={field.onChange} defaultValue={field.value}>
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Select service type" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="PPPOE">PPPoE</SelectItem>
                            <SelectItem value="HOTSPOT">Hotspot</SelectItem>
                            <SelectItem value="STATIC">Static</SelectItem>
                            <SelectItem value="DHCP">DHCP</SelectItem>
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="price"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Price ($)</FormLabel>
                        <FormControl>
                          <Input 
                            type="number" 
                            step="0.01" 
                            {...field} 
                            onChange={e => field.onChange(Number(e.target.value))} 
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
              </div>

              {/* Speed Configuration Section */}
              <div className="space-y-6">
                <div>
                  <h2 className="text-xl font-semibold">Speed Configuration</h2>
                  <p className="text-sm text-muted-foreground">Configure bandwidth and burst settings</p>
                </div>
                <Separator />
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <FormField
                    control={form.control}
                    name="downloadSpeed"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Download Speed (Mbps)</FormLabel>
                        <FormControl>
                          <Input 
                            type="number" 
                            {...field} 
                            onChange={e => field.onChange(Number(e.target.value))} 
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="uploadSpeed"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Upload Speed (Mbps)</FormLabel>
                        <FormControl>
                          <Input 
                            type="number" 
                            {...field} 
                            onChange={e => field.onChange(Number(e.target.value))} 
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="burstDownload"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Burst Download (Mbps)</FormLabel>
                        <FormControl>
                          <Input 
                            type="number" 
                            value={field.value ?? ''}
                            onChange={e => field.onChange(e.target.value === '' ? undefined : Number(e.target.value))} 
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="burstUpload"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Burst Upload (Mbps)</FormLabel>
                        <FormControl>
                          <Input 
                            type="number" 
                            value={field.value ?? ''}
                            onChange={e => field.onChange(e.target.value === '' ? undefined : Number(e.target.value))} 
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="thresholdDownload"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Threshold Download (Mbps)</FormLabel>
                        <FormControl>
                          <Input 
                            type="number" 
                            value={field.value ?? ''}
                            onChange={e => field.onChange(e.target.value === '' ? undefined : Number(e.target.value))} 
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="thresholdUpload"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Threshold Upload (Mbps)</FormLabel>
                        <FormControl>
                          <Input 
                            type="number" 
                            value={field.value ?? ''}
                            onChange={e => field.onChange(e.target.value === '' ? undefined : Number(e.target.value))} 
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="burstTime"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Burst Time (seconds)</FormLabel>
                        <FormControl>
                          <Input 
                            type="number" 
                            value={field.value ?? ''}
                            onChange={e => field.onChange(e.target.value === '' ? undefined : Number(e.target.value))} 
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="addressPool"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Address Pool</FormLabel>
                        <FormControl>
                          <Input 
                            placeholder="Enter address pool" 
                            {...field} 
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
              </div>

              {/* Advanced Configuration Section */}
              <div className="space-y-6">
                <div>
                  <h2 className="text-xl font-semibold">Advanced Configuration</h2>
                  <p className="text-sm text-muted-foreground">Configure session management, QoS, and VLAN settings</p>
                </div>
                <Separator />
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <FormField
                    control={form.control}
                    name="sessionTimeout"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Session Timeout (seconds)</FormLabel>
                        <FormControl>
                          <Input 
                            type="number" 
                            value={field.value ?? ''}
                            onChange={e => field.onChange(e.target.value === '' ? undefined : Number(e.target.value))} 
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="idleTimeout"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Idle Timeout (seconds)</FormLabel>
                        <FormControl>
                          <Input 
                            type="number" 
                            value={field.value ?? ''}
                            onChange={e => field.onChange(e.target.value === '' ? undefined : Number(e.target.value))} 
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="priority"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Queue Priority (1-8)</FormLabel>
                        <FormControl>
                          <Input 
                            type="number" 
                            min={1}
                            max={8}
                            value={field.value ?? ''}
                            onChange={e => field.onChange(e.target.value === '' ? undefined : Number(e.target.value))} 
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="vlanId"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>VLAN ID</FormLabel>
                        <FormControl>
                          <Input 
                            type="number" 
                            value={field.value ?? ''}
                            onChange={e => field.onChange(e.target.value === '' ? undefined : Number(e.target.value))} 
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
              </div>

              {/* Hotspot Configuration Section */}
              <div className="space-y-6">
                <div>
                  <h2 className="text-xl font-semibold">Hotspot Configuration</h2>
                  <p className="text-sm text-muted-foreground">Configure hotspot-specific settings</p>
                </div>
                <Separator />
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <FormField
                    control={form.control}
                    name="showInHotspot"
                    render={({ field }) => (
                      <FormItem className="flex flex-row items-start space-x-3 space-y-0 rounded-md border p-4">
                        <FormControl>
                          <Checkbox
                            checked={field.value}
                            onCheckedChange={field.onChange}
                          />
                        </FormControl>
                        <div className="space-y-1 leading-none">
                          <FormLabel>Show in Hotspot</FormLabel>
                          <p className="text-sm text-muted-foreground">
                            Make this package available in the hotspot portal
                          </p>
                        </div>
                      </FormItem>
                    )}
                  />
                  
                  <div className="md:col-span-2 grid grid-cols-1 md:grid-cols-2 gap-6">
                    <FormField
                      control={form.control}
                      name="duration"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Duration</FormLabel>
                          <FormControl>
                            <Input 
                              type="number" 
                              value={field.value ?? ''}
                              onChange={e => field.onChange(e.target.value === '' ? undefined : Number(e.target.value))} 
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="durationUnit"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Duration Unit</FormLabel>
                          <Select onValueChange={field.onChange} defaultValue={field.value}>
                            <FormControl>
                              <SelectTrigger>
                                <SelectValue placeholder="Select duration unit" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              <SelectItem value="minutes">Minutes</SelectItem>
                              <SelectItem value="hours">Hours</SelectItem>
                              <SelectItem value="days">Days</SelectItem>
                              <SelectItem value="weeks">Weeks</SelectItem>
                              <SelectItem value="months">Months</SelectItem>
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>

                  <div className="md:col-span-2 grid grid-cols-1 md:grid-cols-2 gap-6">
                    <FormField
                      control={form.control}
                      name="dataLimit"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Data Limit</FormLabel>
                          <FormControl>
                            <Input 
                              type="number" 
                              value={field.value ?? ''}
                              onChange={e => field.onChange(e.target.value === '' ? undefined : Number(e.target.value))} 
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="dataLimitUnit"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Data Limit Unit</FormLabel>
                          <Select onValueChange={field.onChange} defaultValue={field.value}>
                            <FormControl>
                              <SelectTrigger>
                                <SelectValue placeholder="Select data limit unit" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              <SelectItem value="MB">MB</SelectItem>
                              <SelectItem value="GB">GB</SelectItem>
                              <SelectItem value="TB">TB</SelectItem>
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                </div>
              </div>

              <div className="flex justify-end space-x-4 pt-6">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => navigateBack()}
                  disabled={isSubmitting}
                  className="gap-2"
                >
                  <ArrowLeft className="size-4" />
                  Cancel
                </Button>
                <Button 
                  type="submit" 
                  disabled={isSubmitting}
                  className="bg-gradient-custom text-white hover:text-white gap-2"
                >
                  {isSubmitting ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Saving...
                    </>
                  ) : (
                    <>
                      <Package2 className="w-4 h-4" />
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








