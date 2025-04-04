"use client";

import { useMutation, useQuery } from "@apollo/client";
import { GET_ISP_CUSTOMER, UPDATE_ISP_CUSTOMER } from "@/graphql/isp_customers";
import { GET_ISP_PACKAGES } from "@/graphql/isp_packages";
import { GET_ISP_STATIONS } from "@/graphql/isp_stations";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { DateTimePicker } from "../../components/DateTimePicker";
import { z } from "zod";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useParams, useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { LoadingSpinner } from "@/components/ui/loading-spinner";
import { ISPPackage } from "@/types/isp_package";
import { ISPStation } from "@/types/isp_station";
import React from "react";
import { ArrowLeft, X, Save } from "lucide-react";

const formSchema = z.object({
  firstName: z.string().min(1, "First name is required"),
  lastName: z.string().min(1, "Last name is required"),
  email: z.string().email("Invalid email address"),
  phone: z.string().min(10, "Phone number must be at least 10 digits"),
  username: z.string().min(1, "Username is required"),
  password: z.string().optional(),
  packageId: z.string().min(1, "Package is required"),
  stationId: z.string().min(1, "Station is required"),
  expirationDate: z.date({
    required_error: "Expiration date is required",
  }),
});

type FormValues = z.infer<typeof formSchema>;

export default function EditCustomerPage() {
  const params = useParams();
  const router = useRouter();
  const organizationId = params.id as string;
  const customerId = params.customerId as string;

  const { data: customerData, loading: customerLoading } = useQuery(GET_ISP_CUSTOMER, {
    variables: { id: customerId },
  });

  const { data: packagesData, loading: packagesLoading } = useQuery(GET_ISP_PACKAGES, {
    variables: { organizationId },
  });
  
  const { data: stationsData, loading: stationsLoading } = useQuery(GET_ISP_STATIONS, {
    variables: { organizationId },
  });

  const [updateCustomer, { loading: isUpdating }] = useMutation(UPDATE_ISP_CUSTOMER, {
    refetchQueries: ["GetISPCustomers"],
  });

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      firstName: "",
      lastName: "",
      email: "",
      phone: "",
      username: "",
      password: "",
      packageId: "",
      stationId: "",
      expirationDate: new Date(),
    },
  });

  // Update form values when customer data is loaded
  React.useEffect(() => {
    if (customerData?.customer) {
      const customer = customerData.customer;
      form.reset({
        firstName: customer.firstName,
        lastName: customer.lastName,
        email: customer.email,
        phone: customer.phone,
        username: customer.username,
        password: customer.password || "",
        packageId: customer.package.id,
        stationId: customer.station.id,
        expirationDate: new Date(customer.expirationDate),
      });
    }
  }, [customerData, form]);

  const onSubmit = async (data: FormValues) => {
    try {
      const submissionData = {
        ...data,
        expirationDate: data.expirationDate.toISOString(),
      };
      
      if (!submissionData.password) {
        delete submissionData.password;
      }

      await updateCustomer({
        variables: { 
          id: customerId,
          input: submissionData,
        },
      });
      
      toast.success("Customer updated successfully");
      router.push(`/${organizationId}/isp/customers`);
    } catch (error) {
      console.error("Error updating customer:", error);
      toast.error("Failed to update customer");
    }
  };

  // Show loading spinner while initial data is loading
  if (customerLoading || packagesLoading || stationsLoading) {
    return <LoadingSpinner />;
  }

  // Get the current package and station names
  const currentPackage = packagesData?.packages.packages.find(
    (pkg: ISPPackage) => pkg.id === customerData?.customer?.package?.id
  );

  const currentStation = stationsData?.stations.stations.find(
    (station: ISPStation) => station.id === customerData?.customer?.station?.id
  );

  return (
    <div className="container mx-auto py-8 max-w-3xl">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-gradient-custom">Edit Customer</h1>
          <p className="text-muted-foreground mt-1">
            Update customer information and settings
          </p>
        </div>
        <Button
          variant="outline"
          onClick={() => router.push(`/${organizationId}/isp/customers`)}
          className="gap-2"
        >
          <ArrowLeft className="size-4" />
          Back to Customers
        </Button>
      </div>

      <Card className="border-border/50 shadow-sm">
        <CardContent className="p-6">
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
              {/* Personal Information Section */}
              <div className="space-y-4">
                <h2 className="text-lg font-medium text-gradient-custom2">
                  Personal Information
                </h2>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="firstName"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>First Name</FormLabel>
                        <FormControl>
                          <Input placeholder="Enter first name" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="lastName"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Last Name</FormLabel>
                        <FormControl>
                          <Input placeholder="Enter last name" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="email"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Email Address</FormLabel>
                        <FormControl>
                          <Input placeholder="customer@example.com" {...field} type="email" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="phone"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Phone Number</FormLabel>
                        <FormControl>
                          <Input placeholder="+1 (555) 000-0000" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
              </div>

              {/* Account Settings Section */}
              <div className="space-y-4 pt-4 border-t">
                <h2 className="text-lg font-medium text-gradient-custom2">
                  Account Settings
                </h2>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="username"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>PPPoE Username</FormLabel>
                        <FormControl>
                          <Input placeholder="Enter username" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="password"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>PPPoE Password</FormLabel>
                        <FormControl>
                          <Input 
                            placeholder="Enter password" 
                            {...field} 
                            type="text"
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
              </div>

              {/* Service Configuration Section */}
              <div className="space-y-4 pt-4 border-t">
                <h2 className="text-lg font-medium text-gradient-custom2">
                  Service Configuration
                </h2>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="packageId"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Internet Package</FormLabel>
                        <Select 
                          onValueChange={field.onChange} 
                          value={field.value}
                        >
                          <FormControl>
                            <SelectTrigger className="bg-background">
                              <SelectValue>
                                {packagesData?.packages.packages.find(
                                  (pkg: ISPPackage) => pkg.id === field.value
                                )?.name || "Select a package"}
                              </SelectValue>
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {packagesData?.packages.packages.map((pkg: ISPPackage) => (
                              <SelectItem key={pkg.id} value={pkg.id}>
                                {pkg.name}
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
                    name="stationId"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Connected Station</FormLabel>
                        <Select 
                          onValueChange={field.onChange} 
                          value={field.value}
                        >
                          <FormControl>
                            <SelectTrigger className="bg-background">
                              <SelectValue>
                                {stationsData?.stations.stations.find(
                                  (station: ISPStation) => station.id === field.value
                                )?.name || "Select a station"}
                              </SelectValue>
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {stationsData?.stations.stations.map((station: ISPStation) => (
                              <SelectItem key={station.id} value={station.id}>
                                {station.name}
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
                    name="expirationDate"
                    render={({ field }) => (
                      <FormItem className="col-span-2">
                        <FormLabel>Service Expiration Date</FormLabel>
                        <FormControl>
                          <DateTimePicker
                            date={field.value}
                            setDate={field.onChange}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex justify-end space-x-3 pt-6 border-t">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => router.push(`/${organizationId}/isp/customers`)}
                  className="gap-2"
                  disabled={isUpdating}
                >
                  <X className="size-4" />
                  Cancel
                </Button>
                <Button 
                  type="submit" 
                  className="gap-2 bg-gradient-custom"
                  disabled={isUpdating}
                >
                  {isUpdating ? (
                    <>
                      <div className="size-4 border-2 border-white/30 border-t-white animate-spin rounded-full" />
                      Saving...
                    </>
                  ) : (
                    <>
                      <Save className="size-4" />
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










