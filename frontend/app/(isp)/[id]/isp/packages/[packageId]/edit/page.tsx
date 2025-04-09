"use client";

import { useEffect, useState } from "react";
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
});

export default function EditPackagePage() {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const params = useParams();
  const router = useRouter();
  const organizationId = params.id as string;
  const packageId = params.packageId as string;
  const { user, loading: userLoading } = useUser();
  const { organization, loading: orgLoading } = useOrganization(organizationId);

  const { data, loading: packageLoading, error } = useQuery(GET_ISP_PACKAGE, {
    variables: { id: packageId },
    onError: (error) => {
      toast.error(error.message);
      router.push(`/${organizationId}/isp/packages`);
    },
    fetchPolicy: "network-only"
  });

  const [updatePackage] = useMutation(UPDATE_ISP_PACKAGE, {
    refetchQueries: ["GetISPPackages"],
    onError: (error) => {
      toast.error(error.message || "Failed to update package");
    }
  });

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      name: "",
      description: "",
      serviceType: "PPPOE",
      downloadSpeed: 0,
      uploadSpeed: 0,
      burstDownload: undefined,
      burstUpload: undefined,
      thresholdDownload: undefined,
      thresholdUpload: undefined,
      burstTime: undefined,
      addressPool: "",
      price: 0,
    },
  });

  useEffect(() => {
    if (data?.package.package) {
      const pkg = data.package.package;
      form.reset({
        name: pkg.name || "",
        description: pkg.description || "",
        serviceType: pkg.serviceType || "PPPOE",
        downloadSpeed: pkg.downloadSpeed || 0,
        uploadSpeed: pkg.uploadSpeed || 0,
        burstDownload: pkg.burstDownload,
        burstUpload: pkg.burstUpload,
        thresholdDownload: pkg.thresholdDownload,
        thresholdUpload: pkg.thresholdUpload,
        burstTime: pkg.burstTime,
        addressPool: pkg.addressPool || "",
        price: pkg.price || 0,
      });
    }
  }, [data, form]);

  const isLoading = userLoading || orgLoading || packageLoading;

  const canManagePackages = organization && user && hasOrganizationPermissions(
    organization,
    user.id,
    OrganizationPermissions.MANAGE_ISP_MANAGER_PACKAGES
  );

  async function onSubmit(values: z.infer<typeof formSchema>) {
    setIsSubmitting(true);
    try {
      await updatePackage({
        variables: {
          id: packageId,
          input: values,
        },
      });
      toast.success("Package updated successfully");
      router.push(`/${organizationId}/isp/packages`);
    } catch {
      // Error is handled by mutation onError
    } finally {
      setIsSubmitting(false);
    }
  }

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
            onClick={() => router.push(`/${organizationId}/isp/packages`)}
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
          onClick={() => router.push(`/${organizationId}/isp/packages`)}
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
                            {...field} 
                            onChange={e => field.onChange(e.target.value ? Number(e.target.value) : undefined)} 
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
                            {...field} 
                            onChange={e => field.onChange(e.target.value ? Number(e.target.value) : undefined)} 
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
                            {...field} 
                            onChange={e => field.onChange(e.target.value ? Number(e.target.value) : undefined)} 
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
                            {...field} 
                            onChange={e => field.onChange(e.target.value ? Number(e.target.value) : undefined)} 
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
                            {...field} 
                            onChange={e => field.onChange(e.target.value ? Number(e.target.value) : undefined)} 
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

              <div className="flex justify-end space-x-4 pt-6">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => router.push(`/${organizationId}/isp/packages`)}
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


