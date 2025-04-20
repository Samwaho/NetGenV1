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
  { value: "VIEW_ORGANIZATION", label: "View Organization" },
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
  { value: "VIEW_ISP_MANAGER_CUSTOMERS", label: "View ISP Manager Customers" },
  { value: "MANAGE_ISP_MANAGER_CUSTOMERS", label: "Manage ISP Manager Customers" },
  { value: "VIEW_ISP_MANAGER_STATIONS", label: "View ISP Manager Stations" },
  { value: "MANAGE_ISP_MANAGER_STATIONS", label: "Manage ISP Manager Stations" },
  { value: "VIEW_ISP_MANAGER_INVENTORY", label: "View ISP Manager Inventory" },
  { value: "MANAGE_ISP_MANAGER_INVENTORY", label: "Manage ISP Manager Inventory" },
  { value: "VIEW_ISP_MANAGER_TICKETS", label: "View ISP Manager Tickets" },
  { value: "MANAGE_ISP_MANAGER_TICKETS", label: "Manage ISP Manager Tickets" },
  { value: "VIEW_MPESA_CONFIG", label: "View Mpesa Config" },
  { value: "MANAGE_MPESA_CONFIG", label: "Manage Mpesa Config" },
  { value: "VIEW_MPESA_TRANSACTIONS", label: "View Mpesa Transactions" },
  { value: "VIEW_CUSTOMER_PAYMENTS", label: "View Customer Payments" },
  { value: "MANAGE_CUSTOMER_PAYMENTS", label: "Manage Customer Payments" },
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
      <DialogContent className="sm:max-w-[500px] max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle>Create New Role</DialogTitle>
        </DialogHeader>
        <div className="overflow-y-auto pr-2">
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
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-2 max-h-[30vh] overflow-y-auto border rounded-md p-3">
                      {availablePermissions.map((permission) => (
                        <FormField
                          key={permission.value}
                          control={form.control}
                          name="permissions"
                          render={({ field }) => (
                            <FormItem
                              key={permission.value}
                              className="flex flex-row items-start space-x-3 space-y-0 py-1"
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
                              <FormLabel className="font-normal text-sm">
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

              <div className="flex justify-end space-x-3 pt-2">
                <Button variant="outline" type="button" onClick={onClose}>
                  Cancel
                </Button>
                <Button type="submit" disabled={loading}>
                  {loading ? "Creating..." : "Create Role"}
                </Button>
              </div>
            </form>
          </Form>
        </div>
      </DialogContent>
    </Dialog>
  );
}
