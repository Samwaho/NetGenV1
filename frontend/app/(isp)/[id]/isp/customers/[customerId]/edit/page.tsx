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
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { LoadingSpinner } from "@/components/ui/loading-spinner";
import { ISPPackage } from "@/types/isp_package";
import { ISPStation } from "@/types/isp_station";
import React from "react";
import { ArrowLeft, X, Save, Loader2, Mail, Phone, User, Lock, Package2, Radio, Calendar } from "lucide-react";
import { Separator } from "@/components/ui/separator";

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

      <Card>
        <CardContent className="pt-6">
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8">
              {/* Personal Information Section */}
              <div className="space-y-6">
                <div>
                  <h2 className="text-xl font-semibold">Personal Information</h2>
                  <p className="text-sm text-muted-foreground">
                    Update the customer's basic contact information
                  </p>
                </div>
                <Separator />
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
              </div>

              {/* PPPoE Credentials Section */}
              <div className="space-y-6">
                <div>
                  <h2 className="text-xl font-semibold">PPPoE Credentials</h2>
                  <p className="text-sm text-muted-foreground">
                    Manage authentication credentials for network access
                  </p>
                </div>
                <Separator />
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
                              type="text"
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
              </div>

              {/* Service Configuration Section */}
              <div className="space-y-6">
                <div>
                  <h2 className="text-xl font-semibold">Service Configuration</h2>
                  <p className="text-sm text-muted-foreground">
                    Manage the customer's service package and connection details
                  </p>
                </div>
                <Separator />
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
                            {packagesData?.packages.packages.map((pkg: ISPPackage) => (
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
                            {stationsData?.stations.stations.map((station: ISPStation) => (
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
                          When the customer's service subscription will expire
                        </FormDescription>
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
                  onClick={() => router.push(`/${organizationId}/isp/customers`)}
                  disabled={isUpdating}
                  className="gap-2"
                >
                  <X className="size-4" />
                  Cancel
                </Button>
                <Button 
                  type="submit" 
                  disabled={isUpdating}
                  className="gap-2 bg-gradient-custom text-white hover:text-white"
                >
                  {isUpdating ? (
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


