"use client";

import { MdOutlineLockReset, MdEmail, MdCheckCircle, MdErrorOutline } from "react-icons/md";
import { FORGOT_PASSWORD, ForgotPasswordResponse } from "@/graphql/auth";
import { useMutation } from "@apollo/client";
import { toast } from "sonner";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

const Page = () => {
  const [email, setEmail] = useState("");
  const router = useRouter();

  const [forgotPassword, { loading, error, data }] = useMutation(FORGOT_PASSWORD, {
    onCompleted: (data: ForgotPasswordResponse) => {
      toast.success(data.forgotPassword.message);
    },
    onError: (error) => {
      toast.error(error.message);
    },
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) {
      toast.error("Please enter your email address");
      return;
    }

    await forgotPassword({
      variables: {
        email,
      },
    });
  };

  return (
    <div className="max-w-md mx-auto space-y-4 p-4 sm:p-8 bg-card rounded-lg glow">
      <div className="flex items-center justify-center">
        <div className="h-12 w-12 rounded-full bg-fuchsia-100 flex items-center justify-center">
          {!data && !error && (
            <MdOutlineLockReset className="h-6 w-6 text-fuchsia-600" />
          )}
          {loading && (
            <div className="h-6 w-6 border-2 border-fuchsia-600 border-t-transparent rounded-full animate-spin" />
          )}
          {data && (
            <MdCheckCircle className="h-6 w-6 text-fuchsia-600" />
          )}
          {error && (
            <MdErrorOutline className="h-6 w-6 text-red-600" />
          )}
        </div>
      </div>

      <h2 className="text-3xl font-bold tracking-tight text-gray-900 dark:text-gray-50 text-center">
        {!data ? "Reset your password" : "Check your email"}
      </h2>

      <p className="text-gray-600 dark:text-gray-400 text-center">
        {!data 
          ? "Enter your email address and we'll send you a link to reset your password."
          : data.forgotPassword.message}
        {error && error.message}
      </p>

      {!data ? (
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none">
                <MdEmail className="h-5 w-5 text-gray-400" />
              </div>
              <Input
                id="email"
                type="email"
                placeholder="Enter your email address"
                className="pl-10"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                disabled={loading}
                required
              />
            </div>
          </div>

          <Button
            type="submit"
            disabled={loading}
            className={cn(
              "w-full h-9 sm:h-10 bg-gradient-custom hover:opacity-80 text-white cursor-pointer text-sm sm:text-base",
              "transition-all duration-200"
            )}
          >
            {loading ? "Sending..." : "Send reset link"}
          </Button>
        </form>
      ) : (
        <div className="space-y-3 pt-4">
          <Button
            onClick={() => router.push("/sign-in")}
            className={cn(
              "w-full h-9 sm:h-10 bg-gradient-custom hover:opacity-80 text-white cursor-pointer text-sm sm:text-base",
              "transition-all duration-200"
            )}
          >
            Back to Sign In
          </Button>
        </div>
      )}

      {!data && (
        <div className="text-center pt-4">
          <Button
            variant="link"
            onClick={() => router.push("/sign-in")}
            className="text-fuchsia-600 hover:text-fuchsia-700"
          >
            Remember your password? Sign in
          </Button>
        </div>
      )}
    </div>
  );
};

export default Page;