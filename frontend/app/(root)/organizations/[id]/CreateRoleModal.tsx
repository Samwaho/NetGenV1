import { CREATE_ROLE } from "@/graphql/organization";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { useMutation } from "@apollo/client";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";

const formSchema = z.object({
  name: z.string().min(1, "Role name is required"),
  description: z.string().optional(),
  permissions: z.array(z.string()),
});

const availablePermissions = [
  { value: "MANAGE_MEMBERS", label: "Manage Members" },
  { value: "MANAGE_ROLES", label: "Manage Roles" },
  { value: "MANAGE_ORGANIZATION", label: "Manage Organization" },
  { value: "VIEW_ANALYTICS", label: "View Analytics" },
  { value: "MANAGE_BILLING", label: "Manage Billing" },
  { value: "MANAGE_SUBSCRIPTIONS", label: "Manage Subscriptions" },
  { value: "ACCESS_ISP_MANAGER", label: "Access ISP Manager" },
  { value: "VIEW_ISP_MANAGER_DASHBOARD", label: "View ISP Manager Dashboard" },
  { value: "VIEW_ISP_MANAGER_PACKAGES", label: "View ISP Manager Packages" },
  {
    value: "MANAGE_ISP_MANAGER_PACKAGES",
    label: "Manage ISP Manager Packages",
  },
];

interface CreateRoleModalProps {
  isOpen: boolean;
  onClose: () => void;
  organizationId: string;
}

export function CreateRoleModal({
  isOpen,
  onClose,
  organizationId,
}: CreateRoleModalProps) {
  const [createRole, { loading }] = useMutation(CREATE_ROLE, {
    onCompleted: (data) => {
      toast.success(data.createRole.message);
      form.reset();
      onClose();
    },
    onError: (error) => {
      toast.error(error.message);
    },
    refetchQueries: ["GetOrganization"],
  });

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      name: "",
      description: "",
      permissions: [],
    },
  });

  const onSubmit = async (values: z.infer<typeof formSchema>) => {
    await createRole({
      variables: {
        organizationId,
        input: values,
      },
    });
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Create New Role</DialogTitle>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Role Name</FormLabel>
                  <FormControl>
                    <Input placeholder="Enter role name" {...field} />
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
                    <Textarea placeholder="Enter role description" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="permissions"
              render={() => (
                <FormItem>
                  <FormLabel>Permissions</FormLabel>
                  <div className="grid grid-cols-2 gap-4">
                    {availablePermissions.map((permission) => (
                      <FormField
                        key={permission.value}
                        control={form.control}
                        name="permissions"
                        render={({ field }) => (
                          <FormItem
                            key={permission.value}
                            className="flex flex-row items-start space-x-3 space-y-0"
                          >
                            <FormControl>
                              <Checkbox
                                checked={field.value?.includes(
                                  permission.value
                                )}
                                onCheckedChange={(checked) => {
                                  const newPermissions = checked
                                    ? [...field.value, permission.value]
                                    : field.value?.filter(
                                        (value) => value !== permission.value
                                      );
                                  field.onChange(newPermissions);
                                }}
                              />
                            </FormControl>
                            <FormLabel className="font-normal">
                              {permission.label}
                            </FormLabel>
                          </FormItem>
                        )}
                      />
                    ))}
                  </div>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="flex justify-end space-x-3">
              <Button variant="outline" type="button" onClick={onClose}>
                Cancel
              </Button>
              <Button type="submit" disabled={loading}>
                {loading ? "Creating..." : "Create Role"}
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
