"use client";

import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { z } from "zod";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation } from "@apollo/client";
import { INVITE_MEMBER } from "@/graphql/organization";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";

const formSchema = z.object({
  email: z.string().email("Please enter a valid email address"),
  roleName: z.string().min(1, "Please select a role"),
  message: z.string().max(500, "Message must be less than 500 characters").optional(),
});

type Role = {
  name: string;
  description?: string;
  isSystemRole: boolean;
  permissions: string[];
};

type InviteMemberModalProps = {
  isOpen: boolean;
  onClose: () => void;
  organizationId: string;
  roles: Role[];
};

const InviteMemberModal = ({
  isOpen,
  onClose,
  organizationId,
  roles,
}: InviteMemberModalProps) => {
  const [inviteMember, { loading }] = useMutation(INVITE_MEMBER, {
    onCompleted: (data) => {
      toast.success(data.inviteMember.message);
      form.reset();
      onClose();
    },
    onError: (error) => {
      const errorMessage = error.message.toLowerCase();
      if (errorMessage.includes("already")) {
        // More user-friendly message for duplicate invitations
        if (errorMessage.includes("active member")) {
          toast.error("This user is already a member of the organization");
        } else if (errorMessage.includes("already been invited")) {
          toast.error("This user has already been invited to join");
        } else {
          toast.error("This user already has a pending invitation");
        }
      } else {
        toast.error(error.message);
      }
    },
  });

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      email: "",
      roleName: "",
      message: "",
    },
  });

  const onSubmit = async (data: z.infer<typeof formSchema>) => {
    await inviteMember({
      variables: {
        organizationId,
        email: data.email,
        roleName: data.roleName,
        message: data.message,
      },
    });
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Invite Team Member</DialogTitle>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="email"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Email address</FormLabel>
                  <FormControl>
                    <Input
                      placeholder="Enter email address"
                      type="email"
                      disabled={loading}
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="roleName"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Role</FormLabel>
                  <Select
                    disabled={loading}
                    onValueChange={field.onChange}
                    value={field.value}
                  >
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Select a role" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {roles.map((role) => (
                        <SelectItem key={role.name} value={role.name}>
                          {role.name}
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
              name="message"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Personal message (optional)</FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder="Add a personal message to the invitation email"
                      className="resize-none"
                      disabled={loading}
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <div className="flex justify-end space-x-2">
              <Button
                type="button"
                variant="outline"
                onClick={onClose}
                disabled={loading}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={loading}>
                {loading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Sending...
                  </>
                ) : (
                  "Send Invitation"
                )}
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
};

export default InviteMemberModal;


