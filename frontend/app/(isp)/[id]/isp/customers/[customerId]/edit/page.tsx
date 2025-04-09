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
  FormDescription,
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
import { Card, CardContent } from "@/components/ui/card";
import { LoadingSpinner } from "@/components/ui/loading-spinner";
import { ISPPackage } from "@/types/isp_package";
import { ISPStation } from "@/types/isp_station";
import React, { memo, useState } from "react";
import { ArrowLeft, X, Save, Loader2, Mail, Phone, User, Lock, Package2, Radio, Calendar } from "lucide-react";
import { Separator } from "@/components/ui/separator";

// Interface for API responses
interface CustomerResponse {
  customer: {
    id: string;
    firstName: string;
    lastName: string;
    email: string;
    phone: string;
    username: string;
    password?: string;
    package: {
      id: string;
      name: string;
    };
    station: {
      id: string;
      name: string;
    };
    expirationDate: string;
  };
}

interface PackagesResponse {
  packages: {
    packages: ISPPackage[];
  };
}

interface StationsResponse {
  stations: {
    stations: ISPStation[];
  };
}

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

// Memoized form section component to prevent unnecessary re-renders
const FormSection = memo(({ 
  title, 
  description, 
  children 
}: { 
  title: string; 
  description: string; 
  children: React.ReactNode 
}) => (
  <div className="space-y-6">
    <div>
      <h2 className="text-xl font-semibold">{title}</h2>
      <p className="text-sm text-muted-foreground">
        {description}
      </p>
    </div>
    <Separator />
    {children}
  </div>
));
FormSection.displayName = "FormSection";

export default function EditCustomerPage() {
  const params = useParams();
  const router = useRouter();
  const organizationId = params.id as string;
  const customerId = params.customerId as string;
  const [isSubmitting, setIsSubmitting] = useState(false);

  const { data: customerData, loading: customerLoading } = useQuery<CustomerResponse>(
    GET_ISP_CUSTOMER, 
    {
      variables: { id: customerId },
      fetchPolicy: "cache-and-network",
      nextFetchPolicy: "cache-first",
    }
  );

  const { data: packagesData, loading: packagesLoading } = useQuery<PackagesResponse>(
    GET_ISP_PACKAGES, 
    {
      variables: { organizationId },
      fetchPolicy: "cache-first",
    }
  );
  
  const { data: stationsData, loading: stationsLoading } = useQuery<StationsResponse>(
    GET_ISP_STATIONS, 
    {
      variables: { organizationId },
      fetchPolicy: "cache-first",
    }
  );

  const [updateCustomer] = useMutation(UPDATE_ISP_CUSTOMER, {
    refetchQueries: ["GetISPCustomers"],
    onError: (error) => {
      console.error("Error updating customer:", error);
      toast.error(error.message || "Failed to update customer");
      setIsSubmitting(false);
    },
    onCompleted: () => {
      toast.success("Customer updated successfully");
      router.push(`/${organizationId}/isp/customers`);
      setIsSubmitting(false);
    }
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
        password: "",
        packageId: customer.package.id,
        stationId: customer.station.id,
        expirationDate: new Date(customer.expirationDate),
      });
    }
  }, [customerData, form]);

  const onSubmit = async (data: FormValues) => {
    try {
      setIsSubmitting(true);
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
    } catch (error: unknown) {
      console.error("Error updating customer:", error);
      const errorMessage = error instanceof Error ? error.message : "Failed to update customer";
      toast.error(errorMessage);
      setIsSubmitting(false);
    }
  };

  // Show loading spinner while initial data is loading
  if (customerLoading || packagesLoading || stationsLoading) {
    return <LoadingSpinner />;
  }

  // Process data once to avoid duplicate calculations in render
  const packages = packagesData?.packages.packages || [];
  const stations = stationsData?.stations.stations || [];
  
  // Get the current package and station names
  const currentPackage = packages.find(
    (pkg) => pkg.id === customerData?.customer?.package?.id
  );

  const currentStation = stations.find(
    (station) => station.id === customerData?.customer?.station?.id
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

      <Card>
        <CardContent className="pt-6">
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8">
              {/* Personal Information Section */}
              <FormSection
                title="Personal Information"
                description="Update the customer&apos;s basic contact information"
              >
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <FormField
                    control={form.control}
                    name="firstName"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>First Name</FormLabel>
                        <FormControl>
                          <div className="relative">
                            <User className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                            <Input className="pl-9" placeholder="John" {...field} />
                          </div>
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
                          <div className="relative">
                            <User className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                            <Input className="pl-9" placeholder="Doe" {...field} />
                          </div>
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="email"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Email Address</FormLabel>
                        <FormControl>
                          <div className="relative">
                            <Mail className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                            <Input className="pl-9" placeholder="john.doe@example.com" type="email" {...field} />
                          </div>
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
                          <div className="relative">
                            <Phone className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                            <Input className="pl-9" placeholder="+1234567890" {...field} />
                          </div>
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
              </FormSection>

              {/* PPPoE Credentials Section */}
              <FormSection
                title="PPPoE Credentials"
                description="Manage authentication credentials for network access"
              >
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <FormField
                    control={form.control}
                    name="username"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Username</FormLabel>
                        <FormControl>
                          <div className="relative">
                            <User className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                            <Input className="pl-9" placeholder="username" {...field} />
                          </div>
                        </FormControl>
                        <FormDescription>
                          Used for PPPoE authentication
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="password"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Password</FormLabel>
                        <FormControl>
                          <div className="relative">
                            <Lock className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                            <Input 
                              className="pl-9" 
                              type="password"
                              placeholder="Leave blank to keep current password" 
                              {...field} 
                            />
                          </div>
                        </FormControl>
                        <FormDescription>
                          Leave empty to keep the current password
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
              </FormSection>

              {/* Service Configuration Section */}
              <FormSection
                title="Service Configuration"
                description="Manage the customer&apos;s service package and connection details"
              >
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <FormField
                    control={form.control}
                    name="packageId"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Internet Package</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value}>
                          <FormControl>
                            <div className="relative">
                              <Package2 className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground z-50" />
                              <SelectTrigger className="pl-9">
                                <SelectValue placeholder="Select a package" />
                              </SelectTrigger>
                            </div>
                          </FormControl>
                          <SelectContent>
                            {packages.map((pkg) => (
                              <SelectItem key={pkg.id} value={pkg.id}>
                                {pkg.name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <FormDescription>
                          Current package: {currentPackage?.name}
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="stationId"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Connection Station</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value}>
                          <FormControl>
                            <div className="relative">
                              <Radio className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground z-50" />
                              <SelectTrigger className="pl-9">
                                <SelectValue placeholder="Select a station" />
                              </SelectTrigger>
                            </div>
                          </FormControl>
                          <SelectContent>
                            {stations.map((station) => (
                              <SelectItem key={station.id} value={station.id}>
                                {station.name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <FormDescription>
                          Current station: {currentStation?.name}
                        </FormDescription>
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
                          <div className="relative">
                            <Calendar className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground z-50" />
                            <div className="pl-9">
                              <DateTimePicker
                                date={field.value}
                                setDate={field.onChange}
                              />
                            </div>
                          </div>
                        </FormControl>
                        <FormDescription>
                          When the customer&apos;s service subscription will expire
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
              </FormSection>

              <div className="flex justify-end space-x-4 pt-6 border-t">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => router.push(`/${organizationId}/isp/customers`)}
                  disabled={isSubmitting}
                  className="gap-2"
                >
                  <X className="size-4" />
                  Cancel
                </Button>
                <Button 
                  type="submit" 
                  disabled={isSubmitting}
                  className="gap-2 bg-gradient-custom text-white hover:text-white"
                >
                  {isSubmitting ? (
                    <>
                      <Loader2 className="size-4 animate-spin" />
                      Saving Changes...
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


