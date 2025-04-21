"use client";

import { MdOutlineCheckCircle, MdErrorOutline } from "react-icons/md";
import { VERIFY_EMAIL, VerifyEmailResponse } from "@/graphql/auth";
import { useMutation } from "@apollo/client";
import { toast } from "sonner";
import { useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { Suspense } from "react";

const VerifyEmailPage = () => {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [verifyEmail, { loading, error, data }] = useMutation(VERIFY_EMAIL, {
    onCompleted: (data: VerifyEmailResponse) => {
      toast.success(data.verifyEmail.message);
      // Remove any stored verification email since process is complete
      localStorage.removeItem("pendingVerificationEmail");
    },
    onError: (error) => {
      toast.error(error.message);
    },
  });

  useEffect(() => {
    const token = searchParams.get("token");
    
    if (!token) {
      // We'll handle this in the UI since we're using Apollo states
      return;
    }

    verifyEmail({
      variables: {
        token: token,
      },
    });
  }, [searchParams, verifyEmail]);

  // Handle the case where no token was provided
  const noToken = !searchParams.get("token");
  const errorMessage = noToken 
    ? "No verification token found in URL. Please check your email link."
    : error?.message;

  return (
    <div className="max-w-md mx-auto space-y-4 p-4 sm:p-8 bg-card rounded-lg glow">
      <div className="flex items-center justify-center">
        <div className="h-12 w-12 rounded-full bg-fuchsia-100 flex items-center justify-center">
          {loading && (
            <div className="h-6 w-6 border-2 border-fuchsia-600 border-t-transparent rounded-full animate-spin" />
          )}
          {data && (
            <MdOutlineCheckCircle className="h-6 w-6 text-fuchsia-600" />
          )}
          {(error || noToken) && (
            <MdErrorOutline className="h-6 w-6 text-red-600" />
          )}
        </div>
      </div>

      <h2 className="text-3xl font-bold tracking-tight text-gray-900 dark:text-gray-50 text-center">
        {loading && "Verifying your email"}
        {data && "Email verified!"}
        {(error || noToken) && "Verification failed"}
      </h2>

      <p className="text-gray-600 dark:text-gray-400 text-center">
        {loading && "Please wait while we confirm your email address..."}
        {data && data.verifyEmail.message}
        {(error || noToken) && errorMessage}
      </p>

      <div className="space-y-3 pt-4">
        {data && (
          <Button
            onClick={() => router.push("/sign-in")}
            className={cn(
              "w-full h-9 sm:h-10 bg-gradient-custom hover:opacity-80 text-white cursor-pointer text-sm sm:text-base mt-6",
              "transition-all duration-200"
            )}
          >
            Sign in to your account
          </Button>
        )}
        
        {(error || noToken) && (
          <>
            <Button
              onClick={() => router.push("/check-verification")}
              className={cn(
                "w-full h-9 sm:h-10 bg-gradient-custom hover:opacity-80 text-white cursor-pointer text-sm sm:text-base mt-6",
                "transition-all duration-200"
              )}
            >
              Try again
            </Button>
            <Button
              onClick={() => router.push("/sign-in")}
              className={cn(
                "w-full h-9 sm:h-10 bg-gradient-custom2 hover:opacity-80 text-white cursor-pointer text-sm sm:text-base",
                "transition-all duration-200"
              )}
            >
              Back to Sign In
            </Button>
          </>
        )}
      </div>
    </div>
  );
};

const Page = () => {
  return (
    <Suspense fallback={<div>Loading...</div>}>
      <VerifyEmailPage />
    </Suspense>
  );
};

export default Page;
