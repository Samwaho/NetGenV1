"use client";

import { useMutation, useQuery } from "@apollo/client";
import { CREATE_ISP_CUSTOMER } from "@/graphql/isp_customers";
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
import { DateTimePicker } from "../components/DateTimePicker";
import { z } from "zod";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useParams, useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { LoadingSpinner } from "@/components/ui/loading-spinner";
import { ArrowLeft, Loader2, UserPlus, Mail, Phone, User, Lock, Package2, Radio, Calendar } from "lucide-react";
import { Separator } from "@/components/ui/separator";

const formSchema = z.object({
  firstName: z.string().min(1, "First name is required"),
  lastName: z.string().min(1, "Last name is required"),
  email: z.string().email("Invalid email address"),
  phone: z.string().min(10, "Phone number must be at least 10 digits"),
  username: z.string().min(1, "Username is required"),
  password: z.string().min(1, "Password is required"),
  packageId: z.string().min(1, "Package is required"),
  stationId: z.string().min(1, "Station is required"),
  expirationDate: z.date({
    required_error: "Expiration date is required",
  }),
});

type FormValues = z.infer<typeof formSchema>;

export default function CreateCustomerPage() {
  const params = useParams();
  const router = useRouter();
  const organizationId = params.id as string;

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
      expirationDate: undefined,
    },
  });

  const { data: packagesData, loading: packagesLoading } = useQuery(GET_ISP_PACKAGES, {
    variables: { organizationId },
  });
  
  const { data: stationsData, loading: stationsLoading } = useQuery(GET_ISP_STATIONS, {
    variables: { organizationId },
  });

  const [createCustomer, { loading: createLoading }] = useMutation(CREATE_ISP_CUSTOMER, {
    refetchQueries: ["GetISPCustomers"],
  });

  const onSubmit = async (data: FormValues) => {
    try {
      const submissionData = {
        ...data,
        organizationId,
        expirationDate: data.expirationDate.toISOString(),
      };
      
      await createCustomer({
        variables: { input: submissionData },
      });
      
      toast.success("Customer created successfully");
      router.push(`/${organizationId}/isp/customers`);
    } catch (error: any) {
      console.error("Error creating customer:", error);
      toast.error(error.message || "Failed to create customer");
    }
  };

  if (packagesLoading || stationsLoading) {
    return <LoadingSpinner />;
  }

  return (
    <div className="container mx-auto py-8 max-w-3xl">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-gradient-custom">Create New Customer</h1>
          <p className="text-muted-foreground mt-1">
            Add a new customer to your internet service
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
                    Enter the customer's basic contact information
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
                            <Input className="pl-9" placeholder="john.doe@example.com" {...field} />
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
                    Set up authentication credentials for network access
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
                          This will be used for PPPoE authentication
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
                            <Input className="pl-9" placeholder="password" {...field} />
                          </div>
                        </FormControl>
                        <FormDescription>
                          Secure password for PPPoE connection
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
                    Configure the customer's service package and connection details
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
                        <Select onValueChange={field.onChange} defaultValue={field.value}>
                          <FormControl>
                            <div className="relative">
                              <Package2 className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                              <SelectTrigger className="pl-9">
                                <SelectValue placeholder="Select a package" />
                              </SelectTrigger>
                            </div>
                          </FormControl>
                          <SelectContent>
                            {packagesData?.packages.packages.map((pkg: any) => (
                              <SelectItem key={pkg.id} value={pkg.id}>
                                {pkg.name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <FormDescription>
                          Choose the service package for this customer
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
                        <Select onValueChange={field.onChange} defaultValue={field.value}>
                          <FormControl>
                            <div className="relative">
                              <Radio className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                              <SelectTrigger className="pl-9">
                                <SelectValue placeholder="Select a station" />
                              </SelectTrigger>
                            </div>
                          </FormControl>
                          <SelectContent>
                            {stationsData?.stations.stations.map((station: any) => (
                              <SelectItem key={station.id} value={station.id}>
                                {station.name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <FormDescription>
                          Select the station where the customer will connect
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
                            <Calendar className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
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

              <div className="flex justify-end space-x-4 pt-6 border-t">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => router.push(`/${organizationId}/isp/customers`)}
                  disabled={createLoading}
                  className="gap-2"
                >
                  <ArrowLeft className="size-4" />
                  Cancel
                </Button>
                <Button 
                  type="submit" 
                  disabled={createLoading}
                  className="bg-gradient-custom text-white hover:text-white gap-2"
                >
                  {createLoading ? (
                    <>
                      <Loader2 className="size-4 animate-spin" />
                      Creating...
                    </>
                  ) : (
                    <>
                      <UserPlus className="size-4" />
                      Create Customer
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



