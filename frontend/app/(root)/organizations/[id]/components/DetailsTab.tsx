"use client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { z } from "zod";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation } from "@apollo/client";
import { UPDATE_ORGANIZATION, DELETE_ORGANIZATION, GET_ORGANIZATION } from "@/graphql/organization";
import { toast } from "sonner";
import { Loader2, Save } from "lucide-react";
import { Organization } from "@/types/organization";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useState } from "react";
import { useRouter } from "next/navigation";

const formSchema = z.object({
  name: z.string()
    .min(1, "Organization name is required")
    .max(100, "Organization name must be less than 100 characters"),
  description: z.string()
    .max(500, "Description must be less than 500 characters")
    .optional(),
});

interface DetailsTabProps {
  organization: Organization;
  currentUserId: string;
}

export const DetailsTab = ({ organization, currentUserId }: DetailsTabProps) => {
  const router = useRouter();
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  const [updateOrganization, { loading }] = useMutation(UPDATE_ORGANIZATION, {
    onCompleted: (data) => {
      toast.success(data.updateOrganization.message);
    },
    onError: (error) => {
      toast.error(error.message);
    },
    refetchQueries: [
      { query: GET_ORGANIZATION, variables: { id: organization.id } }
    ]
  });

  const [deleteOrganization] = useMutation(DELETE_ORGANIZATION, {
    onCompleted: () => {
      toast.success("Organization deleted successfully");
      setIsDeleteDialogOpen(false);
      router.push("/organizations"); // Redirect to organizations list
    },
    onError: (error) => {
      toast.error(error.message || "Failed to delete organization");
      setIsDeleting(false);
    }
  });

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      name: organization.name,
      description: organization.description || "",
    },
  });

  const onSubmit = async (data: z.infer<typeof formSchema>) => {
    await updateOrganization({
      variables: {
        id: organization.id,
        input: data,
      },
    });
  };

  const handleDelete = async () => {
    setIsDeleting(true);
    try {
      await deleteOrganization({
        variables: { id: organization.id },
      });
    } catch {
      // Error is handled in onError callback
    }
  };

  const isOwner = organization.owner.id === currentUserId;

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="text-xl font-semibold">Basic Information</CardTitle>
        </CardHeader>
        <CardContent>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              <FormField
                control={form.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Organization Name</FormLabel>
                    <FormControl>
                      <Input
                        placeholder="Enter organization name"
                        disabled={loading || !isOwner}
                        {...field}
                      />
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
                      <Textarea
                        placeholder="Enter organization description"
                        className="min-h-[100px] resize-none"
                        disabled={loading || !isOwner}
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {isOwner && (
                <div className="flex justify-end pt-4">
                  <Button
                    type="submit"
                    disabled={loading}
                    className="bg-gradient-custom2 text-white hover:text-white"
                  >
                    {loading ? (
                      <>
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        Saving changes...
                      </>
                    ) : (
                      <>
                        <Save className="w-4 h-4 mr-2" />
                        Save Changes
                      </>
                    )}
                  </Button>
                </div>
              )}
            </form>
          </Form>
        </CardContent>
      </Card>

      {isOwner && (
        <Card className="border-destructive">
          <CardHeader>
            <CardTitle className="text-xl font-semibold text-destructive">Danger Zone</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div>
                <h4 className="font-medium">Delete Organization</h4>
                <p className="text-sm text-muted-foreground">
                  Once you delete an organization all members will lose access to it and all associated data will be permanently deleted. This action cannot be undone. Please be certain.
                </p>
              </div>
              <Button
                variant="destructive"
                className="w-full sm:w-auto"
                onClick={() => setIsDeleteDialogOpen(true)}
              >
                Delete Organization
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Organization</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete {organization.name}? This action cannot be undone. Please be certain.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              disabled={isDeleting}
              className="bg-destructive hover:bg-destructive/90"
            >
              {isDeleting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Deleting...
                </>
              ) : (
                'Delete Organization'
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};
