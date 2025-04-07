"use client";

import { useState, use, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { useMutation, useQuery } from "@apollo/client";
import { GET_ISP_INVENTORY, UPDATE_ISP_INVENTORY } from "@/graphql/isp_inventory";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage, FormDescription } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { useRouter } from "next/navigation";
import { Card, CardContent } from "@/components/ui/card";
import { Loader2, Package, ArrowLeft, Save } from "lucide-react";
import { Separator } from "@/components/ui/separator";
import { LoadingSpinner } from "@/components/ui/loading-spinner";

const EquipmentCategoryEnum = {
  ROUTER: 'ROUTER',
  SWITCH: 'SWITCH',
  ACCESS_POINT: 'ACCESS_POINT',
  ANTENNA: 'ANTENNA',
  CABLE: 'CABLE',
  CONNECTOR: 'CONNECTOR',
  POWER_SUPPLY: 'POWER_SUPPLY',
  SERVER: 'SERVER',
  CPE: 'CPE',
  TOOLS: 'TOOLS',
  OTHER: 'OTHER'
} as const;

const formSchema = z.object({
  name: z.string().min(1, "Name is required"),
  category: z.enum(Object.keys(EquipmentCategoryEnum) as [string, ...string[]]),
  model: z.string().optional(),
  manufacturer: z.string().optional(),
  serialNumber: z.string().optional(),
  macAddress: z.string().optional(),
  ipAddress: z.string().optional(),
  quantity: z.number().min(0, "Quantity must be 0 or greater"),
  quantityThreshold: z.number().min(0).optional(),
  unitPrice: z.number().min(0, "Unit price must be 0 or greater"),
  location: z.string().optional(),
  warrantyExpirationDate: z.string().optional(),
  purchaseDate: z.string().optional(),
  specifications: z.string().optional(),
  notes: z.string().optional(),
});

interface EditInventoryPageProps {
  params: Promise<{
    id: string;
    inventoryId: string;
  }>;
}

export default function EditInventoryPage({ params }: EditInventoryPageProps) {
  const { id: organizationId, inventoryId } = use(params);
  const router = useRouter();
  const [isSubmitting, setIsSubmitting] = useState(false);

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      name: "",
      category: "ROUTER" as const, // Explicitly type this as const
      model: "",
      manufacturer: "",
      serialNumber: "",
      macAddress: "",
      ipAddress: "",
      quantity: 0,
      quantityThreshold: 0,
      unitPrice: 0,
      location: "",
      warrantyExpirationDate: "",
      purchaseDate: "",
      specifications: "",
      notes: "",
    },
  });

  const { data: inventoryData, loading: inventoryLoading } = useQuery(GET_ISP_INVENTORY, {
    variables: { id: inventoryId },
    fetchPolicy: "network-only", // Force fetch from network
  });

  // Update form when data is loaded
  useEffect(() => {
    if (inventoryData?.inventory?.inventory) {
      const inventory = inventoryData.inventory.inventory;
      
      const formData = {
        name: inventory.name || "",
        category: inventory.category as keyof typeof EquipmentCategoryEnum || "ROUTER",
        model: inventory.model || "",
        manufacturer: inventory.manufacturer || "",
        serialNumber: inventory.serialNumber || "",
        macAddress: inventory.macAddress || "",
        ipAddress: inventory.ipAddress || "",
        quantity: inventory.quantity || 0,
        quantityThreshold: inventory.quantityThreshold || 0,
        unitPrice: inventory.unitPrice || 0,
        location: inventory.location || "",
        warrantyExpirationDate: inventory.warrantyExpirationDate || "",
        purchaseDate: inventory.purchaseDate || "",
        specifications: inventory.specifications || "",
        notes: inventory.notes || "",
      };

      // Use setValue instead of reset to ensure immediate update
      Object.entries(formData).forEach(([key, value]) => {
        form.setValue(key as any, value);
      });
    }
  }, [inventoryData, form]);

  // Add this to check form values after update
  useEffect(() => {
    const values = form.getValues();
    console.log("Form values after update:", values); // Debug log for form values
    console.log("Current category value:", values.category); // Debug log for category
  }, [form]);

  // Modify the category FormField to add debugging
  const CategoryField = (
    <FormField
      control={form.control}
      name="category"
      render={({ field }) => (
        <FormItem>
          <FormLabel>Category</FormLabel>
          <Select 
            onValueChange={field.onChange} 
            value={field.value}
          >
            <FormControl>
              <SelectTrigger className="bg-background">
                <SelectValue>
                  {Object.keys(EquipmentCategoryEnum).find(
                    (category) => category === field.value
                  )?.replace(/_/g, ' ') || 'Select category'}
                </SelectValue>
              </SelectTrigger>
            </FormControl>
            <SelectContent>
              {Object.keys(EquipmentCategoryEnum).map((category) => (
                <SelectItem key={category} value={category}>
                  {category.replace(/_/g, ' ')}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <FormMessage />
        </FormItem>
      )}
    />
  );

  const [updateInventory] = useMutation(UPDATE_ISP_INVENTORY, {
    refetchQueries: ["GetISPInventories"],
  });

  const onSubmit = async (values: z.infer<typeof formSchema>) => {
    setIsSubmitting(true);
    try {
      await updateInventory({
        variables: {
          id: inventoryId,
          input: values,
        },
      });
      toast.success("Inventory item updated successfully");
      router.push(`/${organizationId}/isp/inventory`);
    } catch (error) {
      console.error("Error updating inventory item:", error);
      toast.error("Failed to update inventory item");
    }
    setIsSubmitting(false);
  };

  if (inventoryLoading) {
    return <LoadingSpinner />;
  }

  return (
    <div className="container max-w-4xl mx-auto py-8 px-4">
      <div className="flex items-center gap-4 mb-6">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => router.push(`/${organizationId}/isp/inventory`)}
          className="hover:bg-transparent hover:text-primary"
        >
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back to Inventory
        </Button>
      </div>

      <div className="flex items-center gap-4 mb-8">
        <Package className="h-8 w-8 text-primary" />
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-gradient-custom">Edit Inventory Item</h1>
          <p className="text-muted-foreground">Update inventory item details</p>
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
                  <p className="text-sm text-muted-foreground">Essential details about the inventory item</p>
                </div>
                <Separator />
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <FormField
                    control={form.control}
                    name="name"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Name</FormLabel>
                        <FormControl>
                          <Input placeholder="Enter item name" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  {CategoryField}

                  <FormField
                    control={form.control}
                    name="manufacturer"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Manufacturer</FormLabel>
                        <FormControl>
                          <Input placeholder="Enter manufacturer" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="model"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Model</FormLabel>
                        <FormControl>
                          <Input placeholder="Enter model" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
              </div>

              {/* Technical Details Section */}
              <div className="space-y-6">
                <div>
                  <h2 className="text-xl font-semibold">Technical Details</h2>
                  <p className="text-sm text-muted-foreground">Specifications and identifiers</p>
                </div>
                <Separator />

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <FormField
                    control={form.control}
                    name="serialNumber"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Serial Number</FormLabel>
                        <FormControl>
                          <Input placeholder="Enter serial number" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="macAddress"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>MAC Address</FormLabel>
                        <FormControl>
                          <Input placeholder="Enter MAC address" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="ipAddress"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>IP Address</FormLabel>
                        <FormControl>
                          <Input placeholder="Enter IP address" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="specifications"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Specifications</FormLabel>
                        <FormControl>
                          <Textarea 
                            placeholder="Enter technical specifications"
                            className="resize-none"
                            {...field}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
              </div>

              {/* Inventory Management Section */}
              <div className="space-y-6">
                <div>
                  <h2 className="text-xl font-semibold">Inventory Management</h2>
                  <p className="text-sm text-muted-foreground">Stock and pricing information</p>
                </div>
                <Separator />

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <FormField
                    control={form.control}
                    name="quantity"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Quantity</FormLabel>
                        <FormControl>
                          <Input 
                            type="number" 
                            placeholder="Enter quantity"
                            {...field}
                            onChange={(e) => field.onChange(Number(e.target.value))}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="quantityThreshold"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Quantity Threshold</FormLabel>
                        <FormControl>
                          <Input 
                            type="number" 
                            placeholder="Enter threshold"
                            {...field}
                            onChange={(e) => field.onChange(Number(e.target.value))}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="unitPrice"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Unit Price</FormLabel>
                        <FormControl>
                          <Input 
                            type="number" 
                            placeholder="Enter unit price"
                            {...field}
                            onChange={(e) => field.onChange(Number(e.target.value))}
                          />
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
                          <Input placeholder="Enter storage location" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="purchaseDate"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Purchase Date</FormLabel>
                        <FormControl>
                          <Input type="date" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="warrantyExpirationDate"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Warranty Expiration</FormLabel>
                        <FormControl>
                          <Input type="date" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="notes"
                    render={({ field }) => (
                      <FormItem className="col-span-2">
                        <FormLabel>Notes</FormLabel>
                        <FormControl>
                          <Textarea 
                            placeholder="Enter additional notes"
                            className="resize-none"
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
                  onClick={() => router.push(`/${organizationId}/isp/inventory`)}
                  disabled={isSubmitting}
                >
                  Cancel
                </Button>
                <Button 
                  type="submit" 
                  disabled={isSubmitting}
                  className="bg-gradient-custom text-white hover:text-white"
                >
                  {isSubmitting ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Saving...
                    </>
                  ) : (
                    <>
                      <Save className="w-4 h-4 mr-2" />
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




