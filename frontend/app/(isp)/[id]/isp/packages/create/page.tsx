"use client";

import { useMemo, useState, useCallback } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { useMutation } from "@apollo/client";
import { CREATE_ISP_PACKAGE } from "@/graphql/isp_packages";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { useParams, useRouter } from "next/navigation";
import { ArrowLeft, Loader2, Package2 } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Checkbox } from "@/components/ui/checkbox";

// Memoize the form schema to prevent unnecessary recalculations
const formSchema = z.object({
  name: z.string().min(2, "Name must be at least 2 characters"),
  description: z.string().optional(),
  serviceType: z.enum(["PPPOE", "HOTSPOT", "STATIC", "DHCP"]),
  downloadSpeed: z.preprocess(val => val === "" ? undefined : Number(val), z.number().min(0, "Download speed must be positive")),
  uploadSpeed: z.preprocess(val => val === "" ? undefined : Number(val), z.number().min(0, "Upload speed must be positive")),
  burstDownload: z.preprocess(val => val === "" ? undefined : Number(val), z.number().optional()),
  burstUpload: z.preprocess(val => val === "" ? undefined : Number(val), z.number().optional()),
  thresholdDownload: z.preprocess(val => val === "" ? undefined : Number(val), z.number().optional()),
  thresholdUpload: z.preprocess(val => val === "" ? undefined : Number(val), z.number().optional()),
  burstTime: z.preprocess(val => val === "" ? undefined : Number(val), z.number().optional()),
  addressPool: z.string().optional(),
  price: z.preprocess(val => val === "" ? undefined : Number(val), z.number().min(0, "Price must be positive")),
  // Session management
  sessionTimeout: z.preprocess(val => val === "" ? undefined : Number(val), z.number().optional()),
  idleTimeout: z.preprocess(val => val === "" ? undefined : Number(val), z.number().optional()),
  // QoS and VLAN
  priority: z.preprocess(val => val === "" ? undefined : Number(val), z.number().optional()),
  vlanId: z.preprocess(val => val === "" ? undefined : Number(val), z.number().optional()),
  // Hotspot specific fields
  showInHotspot: z.boolean().optional(),
  duration: z.preprocess(val => val === "" ? undefined : Number(val), z.number().optional()),
  durationUnit: z.string().optional(),
  dataLimit: z.preprocess(val => val === "" ? undefined : Number(val), z.number().optional()),
  dataLimitUnit: z.string().optional(),
});

export default function CreatePackagePage() {
  // State and hooks
  const [isSubmitting, setIsSubmitting] = useState(false);
  const params = useParams();
  const router = useRouter();
  const organizationId = useMemo(() => params.id as string, [params.id]);

  // Configure mutation with optimized caching
  const [createPackage] = useMutation(CREATE_ISP_PACKAGE, {
    refetchQueries: ["GetISPPackages"],
    onError: (error) => {
      toast.error(error.message || "Failed to create package");
      setIsSubmitting(false);
    },
    onCompleted: () => {
      toast.success("Package created successfully");
      router.push(`/${organizationId}/isp/packages`);
      setIsSubmitting(false);
    },
    // Use fetch policy to improve caching
    fetchPolicy: "no-cache", // Don't cache mutation results
  });

  // Memoize default form values
  const defaultValues = useMemo(() => ({
    name: "",
    description: "",
    serviceType: "PPPOE" as "PPPOE" | "HOTSPOT" | "STATIC" | "DHCP",
    downloadSpeed: "",
    uploadSpeed: "",
    burstDownload: "",
    burstUpload: "",
    thresholdDownload: "",
    thresholdUpload: "",
    burstTime: "",
    addressPool: "",
    price: "",
    // Session management
    sessionTimeout: "",
    idleTimeout: "",
    // QoS and VLAN
    priority: "",
    vlanId: "",
    // Hotspot specific fields
    showInHotspot: false,
    duration: "",
    durationUnit: "days",
    dataLimit: "",
    dataLimitUnit: "MB",
  }), []);

  // Initialize form with memoized resolver and default values
  const form = useForm<any>({
    resolver: zodResolver(formSchema),
    defaultValues,
  });

  // Memoize submit handler to prevent recreating on each render
  const onSubmit = useCallback(async (values: any) => {
    setIsSubmitting(true);
    try {
      await createPackage({
        variables: {
          input: {
            ...values,
            organizationId,
          },
        },
      });
      // Success handling moved to mutation onCompleted
    } catch {
      // Error handling moved to mutation onError
    }
  }, [createPackage, organizationId]);

  // Memoize navigation handler
  const navigateBack = useCallback(() => {
    router.push(`/${organizationId}/isp/packages`);
  }, [router, organizationId]);

  return (
    <div className="container mx-auto py-8 max-w-3xl">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-gradient-custom">Create New Package</h1>
          <p className="text-muted-foreground mt-1">
            Add a new internet service package
          </p>
        </div>
        <Button
          variant="outline"
          onClick={navigateBack}
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
                            onChange={e => field.onChange(e.target.value)} 
                          />
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
                    name="addressPool"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Address Pool</FormLabel>
                        <FormControl>
                          <Input placeholder="Enter address pool" {...field} />
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
                            onChange={e => field.onChange(e.target.value)} 
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
                            onChange={e => field.onChange(e.target.value)} 
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
                            value={field.value ?? ""}
                            onChange={e => field.onChange(e.target.value)} 
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
                            value={field.value ?? ""}
                            onChange={e => field.onChange(e.target.value)} 
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
                            value={field.value ?? ""}
                            onChange={e => field.onChange(e.target.value)} 
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
                            value={field.value ?? ""}
                            onChange={e => field.onChange(e.target.value)} 
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
                            value={field.value ?? ""}
                            onChange={e => field.onChange(e.target.value)} 
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
                            value={field.value ?? ""}
                            onChange={e => field.onChange(e.target.value)} 
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
                            value={field.value ?? ""}
                            onChange={e => field.onChange(e.target.value)} 
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
                            value={field.value ?? ""}
                            onChange={e => field.onChange(e.target.value)} 
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
                            value={field.value ?? ""}
                            onChange={e => field.onChange(e.target.value)} 
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
                              value={field.value ?? ""}
                              onChange={e => field.onChange(e.target.value)} 
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
                              value={field.value ?? ""}
                              onChange={e => field.onChange(e.target.value)} 
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
                  onClick={navigateBack}
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
                      Creating...
                    </>
                  ) : (
                    <>
                      <Package2 className="w-4 h-4" />
                      Create Package
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






