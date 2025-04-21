"use client";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { z } from "zod";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation } from "@apollo/client";
import { REGISTER } from "@/graphql/auth";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Loader2 } from "lucide-react";
import { FcGoogle } from "react-icons/fc";
import { useSearchParams } from "next/navigation";
import { useGoogleAuth } from "@/hooks/useGoogleAuth";
import React, { useEffect, Suspense } from "react";
import { setAuthToken } from "@/lib/auth-utils";

const formSchema = z
  .object({
    email: z.string().email(),
    password: z
      .string()
      .min(1, "Password is required")
      .min(8, "Password must be at least 8 characters")
      .regex(
        /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[!@#$%^&*(),.?":{}|<>])[A-Za-z\d!@#$%^&*(),.?":{}|<>]+$/,
        "Password must contain at least one uppercase letter, one lowercase letter, one number, and one special character"
      ),
    confirmPassword: z.string().min(8),
    firstName: z.string().min(1),
    lastName: z.string().min(1),
    phone: z.string().min(10),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "Passwords do not match",
    path: ["confirmPassword"],
  });

const SignUpFormContent = () => {
  const router = useRouter();
  const searchParams = useSearchParams();
  const {
    getGoogleAuthUrl,
    handleGoogleCallback,
    googleAuthLoading,
    googleCallbackLoading,
  } = useGoogleAuth();

  const codeProcessed = React.useRef(false);

  useEffect(() => {
    const error = searchParams.get("error");
    if (error) {
      const errorMessages: { [key: string]: string } = {
        missing_auth_code: "Authorization code not received from Google",
        invalid_auth_code: "Invalid authorization code",
        missing_credentials: "Failed to obtain Google credentials",
        invalid_token: "Invalid authentication token",
        access_denied: "Access was denied by Google",
        invalid_request: "Invalid authentication request",
        server_error: "Server error occurred during authentication",
      };
      toast.error(errorMessages[error] || "Authentication failed");
    }
  }, [searchParams]);

  useEffect(() => {
    const code = searchParams.get("code");
    const state = searchParams.get("state");
    const error = searchParams.get("error");

    if (error) {
      const errorMessages: { [key: string]: string } = {
        access_denied: "Access was denied by Google",
        invalid_request: "Invalid authentication request",
        invalid_scope: "Invalid scope requested",
        server_error: "Server error occurred during authentication",
        temporarily_unavailable:
          "Google authentication is temporarily unavailable",
      };
      toast.error(errorMessages[error] || "Authentication failed");
      return;
    }

    if (code && state === "google-auth" && !codeProcessed.current) {
      console.log("Processing Google auth callback with code:", code);
      codeProcessed.current = true;
      handleGoogleCallback({
        variables: { code },
      });
    }
  }, [searchParams, handleGoogleCallback]);

  const handleGoogleSignUp = async () => {
    try {
      const { data } = await getGoogleAuthUrl();
      if (data?.googleAuthUrl) {
        console.log("Redirecting to Google auth URL");
        window.location.href = data.googleAuthUrl;
      } else {
        toast.error("Failed to get Google authentication URL");
      }
    } catch (error) {
      console.error("Google auth error:", error);
      toast.error("Failed to initiate Google sign up");
    }
  };

  const [signUp, { loading }] = useMutation(REGISTER, {
    onCompleted: (data) => {
      setAuthToken("Bearer ", data.register.token);
      localStorage.setItem("pendingVerificationEmail", data.register.userEmail);
      toast.success(data.register.message);
      router.push("/check-verification");
    },
    onError: (error) => {
      toast.error(error.message);
    },
  });

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      email: "",
      password: "",
      confirmPassword: "",
      firstName: "",
      lastName: "",
      phone: "",
    },
  });

  const onSubmit = async (data: z.infer<typeof formSchema>) => {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { confirmPassword, ...registerData } = data;
    await signUp({ variables: { input: registerData } });
  };

  return (
    <Form {...form}>
      <form
        onSubmit={form.handleSubmit(onSubmit)}
        className="space-y-4 mt-4 sm:mt-8"
      >
        <div className="grid grid-cols-2 gap-4">
          <FormField
            control={form.control}
            name="firstName"
            render={({ field }) => (
              <FormItem className="space-y-1.5">
                <FormLabel className="text-sm sm:text-base">
                  First Name
                </FormLabel>
                <FormControl>
                  <Input
                    className="h-9 sm:h-10 px-3"
                    placeholder="Enter your first name"
                    disabled={loading}
                    {...field}
                  />
                </FormControl>
                <FormMessage className="text-xs sm:text-sm" />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="lastName"
            render={({ field }) => (
              <FormItem className="space-y-1.5">
                <FormLabel className="text-sm sm:text-base">
                  Last Name
                </FormLabel>
                <FormControl>
                  <Input
                    className="h-9 sm:h-10 px-3"
                    placeholder="Enter your last name"
                    disabled={loading}
                    {...field}
                  />
                </FormControl>
                <FormMessage className="text-xs sm:text-sm" />
              </FormItem>
            )}
          />
        </div>
        <FormField
          control={form.control}
          name="email"
          render={({ field }) => (
            <FormItem className="space-y-1.5">
              <FormLabel className="text-sm sm:text-base">Email</FormLabel>
              <FormControl>
                <Input
                  className="h-9 sm:h-10 px-3"
                  type="email"
                  placeholder="Enter your email"
                  autoComplete="email"
                  disabled={loading}
                  {...field}
                />
              </FormControl>
              <FormMessage className="text-xs sm:text-sm" />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="phone"
          render={({ field }) => (
            <FormItem className="space-y-1.5">
              <FormLabel className="text-sm sm:text-base">
                Phone Number
              </FormLabel>
              <FormControl>
                <Input
                  className="h-9 sm:h-10 px-3"
                  type="tel"
                  placeholder="Enter your phone number"
                  disabled={loading}
                  {...field}
                />
              </FormControl>
              <FormMessage className="text-xs sm:text-sm" />
            </FormItem>
          )}
        />
        <div className="grid grid-cols-2 gap-4">
          <FormField
            control={form.control}
            name="password"
            render={({ field }) => (
              <FormItem className="space-y-1.5">
                <FormLabel className="text-sm sm:text-base">Password</FormLabel>
                <FormControl>
                  <Input
                    className="h-9 sm:h-10 px-3"
                    type="password"
                    placeholder="Enter your password"
                    autoComplete="new-password"
                    disabled={loading}
                    {...field}
                  />
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
                <FormLabel className="text-sm sm:text-base">
                  Confirm Password
                </FormLabel>
                <FormControl>
                  <Input
                    className="h-9 sm:h-10 px-3"
                    type="password"
                    placeholder="Confirm your password"
                    autoComplete="new-password"
                    disabled={loading}
                    {...field}
                  />
                </FormControl>
                <FormMessage className="text-xs sm:text-sm" />
              </FormItem>
            )}
          />
        </div>
        <Button
          type="submit"
          disabled={loading}
          className="w-full h-9 sm:h-10 bg-gradient-custom text-white cursor-pointer text-sm sm:text-base mt-6"
        >
          {loading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
          {loading ? "Creating account..." : "Create account"}
        </Button>
        <div className="relative py-4">
          <div className="absolute inset-0 flex items-center">
            <div className="w-full border-t border-gray-300 dark:border-gray-600" />
          </div>
          <div className="relative flex justify-center text-xs sm:text-sm">
            <span className="bg-white px-2 text-gray-500 dark:bg-gray-800 dark:text-gray-400">
              Or continue with
            </span>
          </div>
        </div>
        <Button
          className="w-full h-9 sm:h-10 flex items-center justify-center space-x-2 bg-gradient-custom2 text-white hover:text-white cursor-pointer text-sm sm:text-base"
          variant="outline"
          onClick={handleGoogleSignUp}
          disabled={googleAuthLoading || googleCallbackLoading}
        >
          <FcGoogle className="h-4 w-4 sm:h-5 sm:w-5" />
          <span className="font-semibold">
            {googleAuthLoading || googleCallbackLoading ? (
              <div className="flex items-center gap-2">
                <Loader2 className="h-4 w-4 animate-spin" />
                Loading...
              </div>
            ) : (
              "Sign up with Google"
            )}
          </span>
        </Button>
      </form>
    </Form>
  );
};

const SignUpForm = () => {
  return (
    <Suspense fallback={<div>Loading...</div>}>
      <SignUpFormContent />
    </Suspense>
  );
};

export default SignUpForm;
