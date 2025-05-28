import { UPDATE_ROLE } from "@/graphql/organization";
import { OrganizationPermissions } from "@/lib/permissions";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import {  useMutation } from "@apollo/client";
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

interface OrganizationRole {
  name: string;
  description?: string | null;
  permissions: string[];
  isSystemRole: boolean;
}


const formSchema = z.object({
  name: z.string().min(1, "Role name is required"),
  description: z.string().optional(),
  permissions: z.array(z.string()),
});

const permissionLabels: Record<string, string> = {
  MANAGE_MEMBERS: "Manage Members",
  MANAGE_ROLES: "Manage Roles",
  VIEW_ORGANIZATION: "View Organization",
  MANAGE_ORGANIZATION: "Manage Organization",
  VIEW_ANALYTICS: "View Analytics",
  MANAGE_BILLING: "Manage Billing",
  MANAGE_SUBSCRIPTIONS: "Manage Subscriptions",
  ACCESS_ISP_MANAGER: "Access ISP Manager",
  VIEW_ISP_MANAGER_DASHBOARD: "View ISP Manager Dashboard",
  VIEW_ISP_MANAGER_PACKAGES: "View ISP Manager Packages",
  MANAGE_ISP_MANAGER_PACKAGES: "Manage ISP Manager Packages",
  VIEW_ISP_MANAGER_CUSTOMERS: "View ISP Manager Customers",
  MANAGE_ISP_MANAGER_CUSTOMERS: "Manage ISP Manager Customers",
  VIEW_ISP_MANAGER_STATIONS: "View ISP Manager Stations",
  MANAGE_ISP_MANAGER_STATIONS: "Manage ISP Manager Stations",
  VIEW_ISP_MANAGER_INVENTORY: "View ISP Manager Inventory",
  MANAGE_ISP_MANAGER_INVENTORY: "Manage ISP Manager Inventory",
  VIEW_ISP_MANAGER_TICKETS: "View ISP Manager Tickets",
  MANAGE_ISP_MANAGER_TICKETS: "Manage ISP Manager Tickets",
  VIEW_MPESA_CONFIG: "View Mpesa Config",
  MANAGE_MPESA_CONFIG: "Manage Mpesa Config",
  VIEW_MPESA_TRANSACTIONS: "View Mpesa Transactions",
  VIEW_SMS_CONFIG: "View SMS Config",
  MANAGE_SMS_CONFIG: "Manage SMS Config",
  VIEW_CUSTOMER_PAYMENTS: "View Customer Payments",
  MANAGE_CUSTOMER_PAYMENTS: "Manage Customer Payments",
  VIEW_ACTIVITY: "View Activity",
  CLEAR_ACTIVITY: "Clear Activity",
};

const availablePermissions = Object.values(OrganizationPermissions).map((perm) => ({
  value: perm,
  label: permissionLabels[perm] || perm,
}));

interface EditRoleModalProps {
  isOpen: boolean;
  onClose: () => void;
  organizationId: string;
  role: OrganizationRole;
}

export function EditRoleModal({ isOpen, onClose, organizationId, role }: EditRoleModalProps) {
  const [updateRole, { loading }] = useMutation(UPDATE_ROLE, {
    onCompleted: (data) => {
      toast.success(data.updateRole.message);
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
      name: role.name,
      description: role.description || "",
      permissions: role.permissions,
    },
  });

  const onSubmit = async (values: z.infer<typeof formSchema>) => {
    await updateRole({
      variables: {
        organizationId,
        roleName: role.name,
        input: {
          name: values.name,
          description: values.description,
          permissions: values.permissions,
        },
      },
    });
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[500px] max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle>Edit Role: {role.name}</DialogTitle>
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
                      <Input 
                        placeholder="Enter role name" 
                        {...field} 
                        disabled={role.isSystemRole}
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
                        placeholder="Enter role description"
                        {...field}
                        disabled={role.isSystemRole}
                      />
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
                                  checked={field.value?.includes(permission.value)}
                                  onCheckedChange={(checked) => {
                                    const newPermissions = checked
                                      ? [...field.value, permission.value]
                                      : field.value?.filter((value) => value !== permission.value);
                                    field.onChange(newPermissions);
                                  }}
                                  disabled={role.isSystemRole}
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
                <Button 
                  type="submit" 
                  disabled={loading || role.isSystemRole}
                >
                  {loading ? "Saving..." : "Save Changes"}
                </Button>
              </div>
            </form>
          </Form>
        </div>
      </DialogContent>
    </Dialog>
  );
}
