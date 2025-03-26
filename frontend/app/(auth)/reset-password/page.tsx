"use client";

import { MdOutlineLockReset, MdErrorOutline } from "react-icons/md";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import ResetPasswordForm from "./ResetPasswordForm";

const Page = () => {
  const searchParams = useSearchParams();
  const token = searchParams.get("token");
  const noToken = !token;

  return (
    <div className="max-w-md mx-auto space-y-4 p-4 sm:p-8 bg-card rounded-lg glow">
      <div className="flex items-center justify-center">
        <div className="h-12 w-12 rounded-full bg-fuchsia-100 flex items-center justify-center">
          {!noToken ? (
            <MdOutlineLockReset className="h-6 w-6 text-fuchsia-600" />
          ) : (
            <MdErrorOutline className="h-6 w-6 text-red-600" />
          )}
        </div>
      </div>

      <h2 className="text-3xl font-bold tracking-tight text-gray-900 dark:text-gray-50 text-center">
        {noToken ? "Invalid Reset Link" : "Reset Your Password"}
      </h2>

      <p className="mt-2 text-center text-sm text-gray-600 dark:text-gray-400">
        {noToken 
          ? "The password reset link is invalid or has expired. Please request a new one." 
          : "Create a new password for your account"}
      </p>

      {noToken ? (
        <div className="space-y-3 pt-4">
          <Link 
            href="/forgot-password"
            className="text-center block w-full mt-6"
          >
            <span className="font-medium text-fuchsia-600 hover:text-fuchsia-500 dark:text-fuchsia-400 dark:hover:text-fuchsia-300 transition-colors duration-200">
              Request a new reset link
            </span>
          </Link>
          <Link 
            href="/sign-in"
            className="text-center block w-full"
          >
            <span className="font-medium text-fuchsia-600 hover:text-fuchsia-500 dark:text-fuchsia-400 dark:hover:text-fuchsia-300 transition-colors duration-200">
              Back to Sign In
            </span>
          </Link>
        </div>
      ) : (
        <ResetPasswordForm token={token} />
      )}
    </div>
  );
};

export default Page;