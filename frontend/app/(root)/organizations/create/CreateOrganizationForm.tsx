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
import { Loader2 } from "lucide-react";
import { Textarea } from "@/components/ui/textarea";

const formSchema = z.object({
  name: z.string()
    .min(1, "Organization name is required")
    .max(100, "Organization name must be less than 100 characters"),
  description: z.string()
    .max(500, "Description must be less than 500 characters")
    .optional(),
});

const CreateOrganizationForm = () => {
  const router = useRouter();

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
    },
  });

  const onSubmit = async (data: z.infer<typeof formSchema>) => {
    await createOrganization({ variables: { input: data } });
  };

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 mt-4 sm:mt-8">
        <FormField
          control={form.control}
          name="name"
          render={({ field }) => (
            <FormItem className="space-y-1.5">
              <FormLabel className="text-sm sm:text-base">Organization Name</FormLabel>
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
              <FormLabel className="text-sm sm:text-base">Description (Optional)</FormLabel>
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

        <Button
          type="submit"
          disabled={loading}
          className="w-full h-9 sm:h-10 bg-gradient-custom text-white cursor-pointer text-sm sm:text-base mt-6"
        >
          {loading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
          {loading ? "Creating organization..." : "Create Organization"}
        </Button>
      </form>
    </Form>
  );
};

export default CreateOrganizationForm;