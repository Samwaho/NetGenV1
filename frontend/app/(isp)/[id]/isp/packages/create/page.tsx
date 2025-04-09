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

// Memoize the form schema to prevent unnecessary recalculations
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
    downloadSpeed: 0,
    uploadSpeed: 0,
    burstDownload: undefined,
    burstUpload: undefined,
    thresholdDownload: undefined,
    thresholdUpload: undefined,
    burstTime: undefined,
    addressPool: "",
    price: 0,
  }), []);

  // Initialize form with memoized resolver and default values
  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues,
  });

  // Memoize submit handler to prevent recreating on each render
  const onSubmit = useCallback(async (values: z.infer<typeof formSchema>) => {
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
                            onChange={e => field.onChange(Number(e.target.value))} 
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
                            onChange={e => e.target.value ? field.onChange(Number(e.target.value)) : field.onChange(undefined)} 
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
                            onChange={e => e.target.value ? field.onChange(Number(e.target.value)) : field.onChange(undefined)} 
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
                            onChange={e => e.target.value ? field.onChange(Number(e.target.value)) : field.onChange(undefined)} 
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
                            onChange={e => e.target.value ? field.onChange(Number(e.target.value)) : field.onChange(undefined)} 
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
                            onChange={e => e.target.value ? field.onChange(Number(e.target.value)) : field.onChange(undefined)} 
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
