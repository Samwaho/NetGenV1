"use client";

import { MdLockOutline } from "react-icons/md";
import { RESET_PASSWORD, ResetPasswordResponse } from "@/graphql/auth";
import { useMutation } from "@apollo/client";
import { toast } from "sonner";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { z } from "zod";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Loader2 } from "lucide-react";

interface ResetPasswordFormProps {
  token: string | null;
}

const formSchema = z.object({
  newPassword: z.string().min(8, "Password must be at least 8 characters"),
  confirmPassword: z.string(),
}).refine(data => data.newPassword === data.confirmPassword, {
  message: "Passwords do not match",
  path: ["confirmPassword"],
});

const ResetPasswordForm = ({ token }: ResetPasswordFormProps) => {
  const router = useRouter();

  const [resetPassword, { loading, data }] = useMutation(RESET_PASSWORD, {
    onCompleted: (data: ResetPasswordResponse) => {
      toast.success(data.resetPassword.message);
    },
    onError: (error) => {
      toast.error(error.message);
    },
  });

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      newPassword: "",
      confirmPassword: "",
    },
  });

  const onSubmit = async (values: z.infer<typeof formSchema>) => {
    if (!token) {
      toast.error("Reset token is missing");
      return;
    }

    await resetPassword({
      variables: {
        token,
        newPassword: values.newPassword,
      },
    });
  };

  if (data) {
    return (
      <div className="space-y-3 pt-4">
        <Button
          onClick={() => router.push("/sign-in")}
          className={cn(
            "w-full h-9 sm:h-10 bg-gradient-custom hover:opacity-80 text-white cursor-pointer text-sm sm:text-base",
            "transition-all duration-200"
          )}
        >
          Sign in with new password
        </Button>
      </div>
    );
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 mt-4">
        <FormField
          control={form.control}
          name="newPassword"
          render={({ field }) => (
            <FormItem className="space-y-1.5">
              <FormLabel className="text-sm sm:text-base">New Password</FormLabel>
              <FormControl>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none">
                    <MdLockOutline className="h-5 w-5 text-gray-400" />
                  </div>
                  <Input
                    type="password"
                    placeholder="Enter new password"
                    className="h-9 sm:h-10 pl-10"
                    disabled={loading}
                    {...field}
                  />
                </div>
              </FormControl>
              <FormMessage className="text-xs sm:text-sm" />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="confirmPassword"
          render={({ field }) => (
            <FormItem className="space-y-1.5">
              <FormLabel className="text-sm sm:text-base">Confirm Password</FormLabel>
              <FormControl>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none">
                    <MdLockOutline className="h-5 w-5 text-gray-400" />
                  </div>
                  <Input
                    type="password"
                    placeholder="Confirm new password"
                    className="h-9 sm:h-10 pl-10"
                    disabled={loading}
                    {...field}
                  />
                </div>
              </FormControl>
              <FormMessage className="text-xs sm:text-sm" />
            </FormItem>
          )}
        />

        <Button
          type="submit"
          disabled={loading}
          className={cn(
            "w-full h-9 sm:h-10 bg-gradient-custom hover:opacity-80 text-white cursor-pointer text-sm sm:text-base mt-6",
            "transition-all duration-200"
          )}
        >
          {loading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
          {loading ? "Resetting..." : "Reset Password"}
        </Button>

        <div className="text-center pt-2">
          <Button
            variant="link"
            onClick={() => router.push("/forgot-password")}
            className="text-fuchsia-600 hover:text-fuchsia-700"
          >
            Need a new reset link?
          </Button>
        </div>
      </form>
    </Form>
  );
};

export default ResetPasswordForm; 