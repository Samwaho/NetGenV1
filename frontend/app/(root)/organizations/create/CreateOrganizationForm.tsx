"use client";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { z } from "zod";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation } from "@apollo/client";
import { CREATE_ORGANIZATION } from "@/graphql/organization";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Loader2, Plus, X } from "lucide-react";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { useState } from "react";
import { SimpleImageUpload } from "@/components/ui/simple-image-upload";

const formSchema = z.object({
  name: z.string()
    .min(1, "Organization name is required")
    .max(100, "Organization name must be less than 100 characters"),
  description: z.string()
    .max(500, "Description must be less than 500 characters")
    .optional(),
  contact: z.object({
    email: z.string().email("Invalid email").optional().or(z.literal("")),
    phone: z.string().optional(),
    website: z.string().url("Invalid URL").optional().or(z.literal("")),
    address: z.string().optional(),
    city: z.string().optional(),
    state: z.string().optional(),
    country: z.string().optional(),
    postalCode: z.string().optional(),
    timezone: z.string().optional(),
  }).optional(),
  business: z.object({
    legalName: z.string().optional(),
    taxId: z.string().optional(),
    registrationNumber: z.string().optional(),
    industry: z.string().optional(),
    businessType: z.string().optional(),
    foundedDate: z.string().optional(),
    employeeCount: z.number().min(1).optional(),
    annualRevenue: z.string().optional(),
    logo: z.string().url("Invalid URL").optional().or(z.literal("")),
    banner: z.string().url("Invalid URL").optional().or(z.literal("")),
  }).optional(),
  tags: z.array(z.string()).optional(),
});

const CreateOrganizationForm = () => {
  const router = useRouter();
  const [newTag, setNewTag] = useState("");

  const [createOrganization, { loading }] = useMutation(CREATE_ORGANIZATION, {
    onCompleted: (data) => {
      toast.success(data.createOrganization.message);
      router.push(`/organizations/${data.createOrganization.organization.id}`);
    },
    onError: (error) => {
      toast.error(error.message);
    },
  });

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      name: "",
      description: "",
      contact: {
        email: "",
        phone: "",
        website: "",
        address: "",
        city: "",
        state: "",
        country: "",
        postalCode: "",
        timezone: "",
      },
      business: {
        legalName: "",
        taxId: "",
        registrationNumber: "",
        industry: "",
        businessType: "",
        foundedDate: "",
        employeeCount: undefined,
        annualRevenue: "",
        logo: "",
        banner: "",
      },
      tags: [],
    },
  });

  const onSubmit = async (data: z.infer<typeof formSchema>) => {
    // Clean up empty strings and undefined values
    const cleanedData = {
      ...data,
      contact: data.contact ? Object.fromEntries(
        Object.entries(data.contact).filter(([_, value]) => value !== "" && value !== undefined)
      ) : undefined,
      business: data.business ? Object.fromEntries(
        Object.entries(data.business).filter(([_, value]) => value !== "" && value !== undefined)
      ) : undefined,
      tags: data.tags?.filter(tag => tag.trim() !== "") || [],
    };

    await createOrganization({ variables: { input: cleanedData } });
  };

  const addTag = () => {
    if (newTag.trim() && !form.getValues("tags")?.includes(newTag.trim())) {
      const currentTags = form.getValues("tags") || [];
      form.setValue("tags", [...currentTags, newTag.trim()]);
      setNewTag("");
    }
  };

  const removeTag = (tagToRemove: string) => {
    const currentTags = form.getValues("tags") || [];
    form.setValue("tags", currentTags.filter(tag => tag !== tagToRemove));
  };

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8">
        {/* Basic Information */}
        <Card>
          <CardHeader>
            <CardTitle>Basic Information</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem className="space-y-1.5">
                  <FormLabel className="text-sm sm:text-base">Organization Name *</FormLabel>
                  <FormControl>
                    <Input
                      className="h-9 sm:h-10 px-3"
                      placeholder="Enter organization name"
                      disabled={loading}
                      {...field}
                    />
                  </FormControl>
                  <FormMessage className="text-xs sm:text-sm" />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="description"
              render={({ field }) => (
                <FormItem className="space-y-1.5">
                  <FormLabel className="text-sm sm:text-base">Description</FormLabel>
                  <FormControl>
                    <Textarea
                      className="min-h-[100px] resize-none"
                      placeholder="Enter organization description"
                      disabled={loading}
                      {...field}
                    />
                  </FormControl>
                  <FormMessage className="text-xs sm:text-sm" />
                </FormItem>
              )}
            />
          </CardContent>
        </Card>

        {/* Contact Information */}
        <Card>
          <CardHeader>
            <CardTitle>Contact Information</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <FormField
                control={form.control}
                name="contact.email"
                render={({ field }) => (
                  <FormItem className="space-y-1.5">
                    <FormLabel className="text-sm sm:text-base">Email</FormLabel>
                    <FormControl>
                      <Input
                        className="h-9 sm:h-10 px-3"
                        placeholder="contact@organization.com"
                        disabled={loading}
                        {...field}
                      />
                    </FormControl>
                    <FormMessage className="text-xs sm:text-sm" />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="contact.phone"
                render={({ field }) => (
                  <FormItem className="space-y-1.5">
                    <FormLabel className="text-sm sm:text-base">Phone</FormLabel>
                    <FormControl>
                      <Input
                        className="h-9 sm:h-10 px-3"
                        placeholder="+1234567890"
                        disabled={loading}
                        {...field}
                      />
                    </FormControl>
                    <FormMessage className="text-xs sm:text-sm" />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="contact.website"
                render={({ field }) => (
                  <FormItem className="space-y-1.5">
                    <FormLabel className="text-sm sm:text-base">Website</FormLabel>
                    <FormControl>
                      <Input
                        className="h-9 sm:h-10 px-3"
                        placeholder="https://www.organization.com"
                        disabled={loading}
                        {...field}
                      />
                    </FormControl>
                    <FormMessage className="text-xs sm:text-sm" />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="contact.timezone"
                render={({ field }) => (
                  <FormItem className="space-y-1.5">
                    <FormLabel className="text-sm sm:text-base">Timezone</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value || ""}>
                      <FormControl>
                        <SelectTrigger className="h-9 sm:h-10">
                          <SelectValue placeholder="Select timezone" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="UTC">UTC</SelectItem>
                        <SelectItem value="America/New_York">Eastern Time</SelectItem>
                        <SelectItem value="America/Chicago">Central Time</SelectItem>
                        <SelectItem value="America/Denver">Mountain Time</SelectItem>
                        <SelectItem value="America/Los_Angeles">Pacific Time</SelectItem>
                        <SelectItem value="Europe/London">London</SelectItem>
                        <SelectItem value="Europe/Paris">Paris</SelectItem>
                        <SelectItem value="Asia/Tokyo">Tokyo</SelectItem>
                        <SelectItem value="Africa/Nairobi">Nairobi</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage className="text-xs sm:text-sm" />
                  </FormItem>
                )}
              />
            </div>

            <FormField
              control={form.control}
              name="contact.address"
              render={({ field }) => (
                <FormItem className="space-y-1.5">
                  <FormLabel className="text-sm sm:text-base">Address</FormLabel>
                  <FormControl>
                    <Input
                      className="h-9 sm:h-10 px-3"
                      placeholder="123 Main Street"
                      disabled={loading}
                      {...field}
                    />
                  </FormControl>
                  <FormMessage className="text-xs sm:text-sm" />
                </FormItem>
              )}
            />

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <FormField
                control={form.control}
                name="contact.city"
                render={({ field }) => (
                  <FormItem className="space-y-1.5">
                    <FormLabel className="text-sm sm:text-base">City</FormLabel>
                    <FormControl>
                      <Input
                        className="h-9 sm:h-10 px-3"
                        placeholder="City"
                        disabled={loading}
                        {...field}
                      />
                    </FormControl>
                    <FormMessage className="text-xs sm:text-sm" />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="contact.state"
                render={({ field }) => (
                  <FormItem className="space-y-1.5">
                    <FormLabel className="text-sm sm:text-base">State</FormLabel>
                    <FormControl>
                      <Input
                        className="h-9 sm:h-10 px-3"
                        placeholder="State"
                        disabled={loading}
                        {...field}
                      />
                    </FormControl>
                    <FormMessage className="text-xs sm:text-sm" />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="contact.country"
                render={({ field }) => (
                  <FormItem className="space-y-1.5">
                    <FormLabel className="text-sm sm:text-base">Country</FormLabel>
                    <FormControl>
                      <Input
                        className="h-9 sm:h-10 px-3"
                        placeholder="Country"
                        disabled={loading}
                        {...field}
                      />
                    </FormControl>
                    <FormMessage className="text-xs sm:text-sm" />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="contact.postalCode"
                render={({ field }) => (
                  <FormItem className="space-y-1.5">
                    <FormLabel className="text-sm sm:text-base">Postal Code</FormLabel>
                    <FormControl>
                      <Input
                        className="h-9 sm:h-10 px-3"
                        placeholder="12345"
                        disabled={loading}
                        {...field}
                      />
                    </FormControl>
                    <FormMessage className="text-xs sm:text-sm" />
                  </FormItem>
                )}
              />
            </div>
          </CardContent>
        </Card>

        {/* Business Information */}
        <Card>
          <CardHeader>
            <CardTitle>Business Information</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <FormField
                control={form.control}
                name="business.legalName"
                render={({ field }) => (
                  <FormItem className="space-y-1.5">
                    <FormLabel className="text-sm sm:text-base">Legal Name</FormLabel>
                    <FormControl>
                      <Input
                        className="h-9 sm:h-10 px-3"
                        placeholder="Legal business name"
                        disabled={loading}
                        {...field}
                      />
                    </FormControl>
                    <FormMessage className="text-xs sm:text-sm" />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="business.taxId"
                render={({ field }) => (
                  <FormItem className="space-y-1.5">
                    <FormLabel className="text-sm sm:text-base">Tax ID</FormLabel>
                    <FormControl>
                      <Input
                        className="h-9 sm:h-10 px-3"
                        placeholder="Tax identification number"
                        disabled={loading}
                        {...field}
                      />
                    </FormControl>
                    <FormMessage className="text-xs sm:text-sm" />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="business.registrationNumber"
                render={({ field }) => (
                  <FormItem className="space-y-1.5">
                    <FormLabel className="text-sm sm:text-base">Registration Number</FormLabel>
                    <FormControl>
                      <Input
                        className="h-9 sm:h-10 px-3"
                        placeholder="Business registration number"
                        disabled={loading}
                        {...field}
                      />
                    </FormControl>
                    <FormMessage className="text-xs sm:text-sm" />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="business.industry"
                render={({ field }) => (
                  <FormItem className="space-y-1.5">
                    <FormLabel className="text-sm sm:text-base">Industry</FormLabel>
                    <FormControl>
                      <Input
                        className="h-9 sm:h-10 px-3"
                        placeholder="e.g., Technology, Healthcare"
                        disabled={loading}
                        {...field}
                      />
                    </FormControl>
                    <FormMessage className="text-xs sm:text-sm" />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="business.businessType"
                render={({ field }) => (
                  <FormItem className="space-y-1.5">
                    <FormLabel className="text-sm sm:text-base">Business Type</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value || ""}>
                      <FormControl>
                        <SelectTrigger className="h-9 sm:h-10">
                          <SelectValue placeholder="Select business type" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="LLC">LLC</SelectItem>
                        <SelectItem value="Corporation">Corporation</SelectItem>
                        <SelectItem value="Sole Proprietorship">Sole Proprietorship</SelectItem>
                        <SelectItem value="Partnership">Partnership</SelectItem>
                        <SelectItem value="Non-Profit">Non-Profit</SelectItem>
                        <SelectItem value="Other">Other</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage className="text-xs sm:text-sm" />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="business.foundedDate"
                render={({ field }) => (
                  <FormItem className="space-y-1.5">
                    <FormLabel className="text-sm sm:text-base">Founded Date</FormLabel>
                    <FormControl>
                      <Input
                        type="date"
                        className="h-9 sm:h-10 px-3"
                        disabled={loading}
                        value={field.value || ""}
                        onChange={field.onChange}
                        onBlur={field.onBlur}
                        name={field.name}
                      />
                    </FormControl>
                    <FormMessage className="text-xs sm:text-sm" />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="business.employeeCount"
                render={({ field }) => (
                  <FormItem className="space-y-1.5">
                    <FormLabel className="text-sm sm:text-base">Employee Count</FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        className="h-9 sm:h-10 px-3"
                        placeholder="Number of employees"
                        disabled={loading}
                        value={field.value || ""}
                        onChange={(e) => field.onChange(e.target.value ? parseInt(e.target.value) : undefined)}
                        onBlur={field.onBlur}
                        name={field.name}
                      />
                    </FormControl>
                    <FormMessage className="text-xs sm:text-sm" />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="business.annualRevenue"
                render={({ field }) => (
                  <FormItem className="space-y-1.5">
                    <FormLabel className="text-sm sm:text-base">Annual Revenue</FormLabel>
                    <FormControl>
                      <Input
                        className="h-9 sm:h-10 px-3"
                        placeholder="e.g., $1M - $10M"
                        disabled={loading}
                        {...field}
                      />
                    </FormControl>
                    <FormMessage className="text-xs sm:text-sm" />
                  </FormItem>
                )}
              />
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <FormField
                control={form.control}
                name="business.logo"
                render={({ field }) => (
                  <FormItem className="space-y-1.5">
                    <FormControl>
                      <SimpleImageUpload
                        value={field.value || ""}
                        onChange={field.onChange}
                        label="Logo"
                        placeholder="Upload logo"
                        disabled={loading}
                        showPreview={true}
                        maxSize={5} // 5MB for logo
                      />
                    </FormControl>
                    <FormMessage className="text-xs sm:text-sm" />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="business.banner"
                render={({ field }) => (
                  <FormItem className="space-y-1.5">
                    <FormControl>
                      <SimpleImageUpload
                        value={field.value || ""}
                        onChange={field.onChange}
                        label="Banner"
                        placeholder="Upload banner"
                        disabled={loading}
                        showPreview={true}
                        maxSize={10} // 10MB for banner
                      />
                    </FormControl>
                    <FormMessage className="text-xs sm:text-sm" />
                  </FormItem>
                )}
              />
            </div>
          </CardContent>
        </Card>

        {/* Tags */}
        <Card>
          <CardHeader>
            <CardTitle>Tags</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex gap-2">
              <Input
                placeholder="Add a tag"
                value={newTag}
                onChange={(e) => setNewTag(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && (e.preventDefault(), addTag())}
                className="flex-1"
              />
              <Button type="button" onClick={addTag} variant="outline" size="sm">
                <Plus className="h-4 w-4" />
              </Button>
            </div>
            
            <div className="flex flex-wrap gap-2">
              {form.watch("tags")?.map((tag, index) => (
                <Badge key={index} variant="secondary" className="flex items-center gap-1">
                  {tag}
                  <button
                    type="button"
                    onClick={() => removeTag(tag)}
                    className="ml-1 hover:bg-destructive hover:text-destructive-foreground rounded-full p-0.5"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </Badge>
              ))}
            </div>
          </CardContent>
        </Card>

        <Button
          type="submit"
          disabled={loading}
          className="w-full h-9 sm:h-10 bg-gradient-custom text-white cursor-pointer text-sm sm:text-base"
        >
          {loading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
          {loading ? "Creating organization..." : "Create Organization"}
        </Button>
      </form>
    </Form>
  );
};

export default CreateOrganizationForm;