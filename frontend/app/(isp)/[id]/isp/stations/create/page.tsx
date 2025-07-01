"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { useMutation } from "@apollo/client";
import { CREATE_ISP_STATION } from "@/graphql/isp_stations";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { useParams, useRouter } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";

const formSchema = z.object({
  name: z.string().min(2, "Name must be at least 2 characters"),
  description: z.string().optional(),
  location: z.string().min(1, "Location is required"),
  buildingType: z.enum(["APARTMENT", "OFFICE", "SCHOOL", "HOSPITAL", "RESIDENTIAL", "COMMERCIAL", "INDUSTRIAL", "GOVERNMENT", "OTHER"]),
  notes: z.string().optional(),
  coordinates: z.string().optional(),
});

export default function CreateStationPage() {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const params = useParams();
  const router = useRouter();
  const organizationId = params.id as string;
  
  const [createStation] = useMutation(CREATE_ISP_STATION, {
    refetchQueries: [
      {
        query: require("@/graphql/isp_stations").GET_ISP_STATIONS,
        variables: { organizationId },
      },
    ],
    onError: (error) => {
      toast.error(error.message || "Failed to create station");
    },
  });

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      name: "",
      description: "",
      location: "",
      buildingType: "COMMERCIAL",
      notes: "",
      coordinates: "",
    },
  });

  async function onSubmit(values: z.infer<typeof formSchema>) {
    setIsSubmitting(true);
    try {
      await createStation({
        variables: {
          input: {
            ...values,
            organizationId,
          },
        },
      });
      toast.success("Station created successfully");
      router.push(`/${organizationId}/isp/stations`);
    } catch {
      // Error is handled by the mutation's onError callback
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="container mx-auto py-8 max-w-3xl">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-gradient-custom">Create New Station</h1>
          <p className="text-muted-foreground mt-1">
            Add a new station to your network
          </p>
        </div>
        <Button
          variant="outline"
          onClick={() => router.push(`/${organizationId}/isp/stations`)}
          className="gap-2"
        >
          <ArrowLeft className="size-4" />
          Back to Stations
        </Button>
      </div>

      <Card>
        <CardContent className="pt-6">
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              <FormField
                control={form.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Name</FormLabel>
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
                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select building type" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {(['APARTMENT', 'OFFICE', 'SCHOOL', 'HOSPITAL', 'RESIDENTIAL', 'COMMERCIAL', 'INDUSTRIAL', 'GOVERNMENT', 'OTHER'] as const).map((type) => (
                          <SelectItem key={type} value={type}>
                            {type}
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
                name="description"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Description</FormLabel>
                    <FormControl>
                      <Textarea placeholder="Enter description" {...field} />
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
                      <Input placeholder="latitude,longitude" {...field} />
                    </FormControl>
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
                      <Textarea placeholder="Enter additional notes" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="flex justify-end space-x-3 pt-6 border-t">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => router.push(`/${organizationId}/isp/stations`)}
                  disabled={isSubmitting}
                >
                  Cancel
                </Button>
                <Button 
                  type="submit" 
                  className="bg-gradient-custom text-white hover:text-white"
                  disabled={isSubmitting}
                >
                  {isSubmitting ? "Creating..." : "Create Station"}
                </Button>
              </div>
            </form>
          </Form>
        </CardContent>
      </Card>
    </div>
  );
}