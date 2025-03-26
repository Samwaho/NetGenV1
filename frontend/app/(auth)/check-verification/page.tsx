"use client";

import { MdOutlineMarkEmailRead, MdOutlineEmail } from "react-icons/md";
import { RESEND_VERIFICATION } from "@/graphql/auth";
import { useMutation } from "@apollo/client";
import { toast } from "sonner";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const Page = () => {
  const [email, setEmail] = useState<string>("");
  const router = useRouter();

  const [resendVerification, { loading }] = useMutation(RESEND_VERIFICATION, {
    onCompleted: (data) => {
      toast.success(data.resendVerification.message);
    },
    onError: (error) => {
      toast.error(error.message);
    },
  });

  useEffect(() => {
    const storedEmail = localStorage.getItem("pendingVerificationEmail");
    if (storedEmail) {
      setEmail(storedEmail);
    } else {
      router.replace("/sign-up");
    }
  }, [router]);

  const handleResendVerification = async () => {
    if (email) {
      await resendVerification({
        variables: {
          email: email,
        },
      });
    } else {
      toast.error("No email found. Please sign up again.");
      router.push("/sign-up");
    }
  };

  return (
    <div className="max-w-md mx-auto space-y-4 p-4 sm:p-8 bg-card rounded-lg glow">
      <div className="flex items-center justify-center">
        <div className="h-12 w-12 rounded-full bg-fuchsia-100 flex items-center justify-center">
          <MdOutlineMarkEmailRead className="h-6 w-6 text-fuchsia-600" />
        </div>
      </div>

      <h2 className="text-3xl font-bold tracking-tight text-gray-900 dark:text-gray-50 text-center">
        Check your email
      </h2>

      <p className="text-gray-600 dark:text-gray-400 text-center">
        We&apos;ve sent a verification link to:
      </p>

      <div className="flex items-center justify-center gap-2 text-lg font-medium">
        <MdOutlineEmail className="h-5 w-5 text-fuchsia-600" />
        <span className="break-all">{email}</span>
      </div>

      <div className="space-y-4 pt-4">
        <p className="text-sm text-gray-600 dark:text-gray-400 text-center">
          Didn&apos;t receive the email?
        </p>

        <div className="space-y-3">
          <Button
            onClick={handleResendVerification}
            disabled={loading}
            className={cn(
              "w-full h-9 sm:h-10 bg-gradient-custom hover:opacity-80 text-white cursor-pointer text-sm sm:text-base mt-6",
              "transition-all duration-200"
            )}
          >
            Resend verification email
          </Button>
          <Button
            onClick={() => router.push("/sign-in")}
            className={cn(
              "w-full h-9 sm:h-10 bg-gradient-custom2 hover:opacity-80 text-white cursor-pointer text-sm sm:text-base mt-6",
              "transition-all duration-200"
            )}
          >
            Back to Sign In
          </Button>
        </div>
      </div>
    </div>
  );
};

export default Page;
