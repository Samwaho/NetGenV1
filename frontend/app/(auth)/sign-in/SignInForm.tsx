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
import { SIGN_IN } from "@/graphql/auth";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Loader2 } from "lucide-react";
import { FcGoogle } from "react-icons/fc";
import { useSearchParams } from "next/navigation";
import { useGoogleAuth } from "@/hooks/useGoogleAuth";
import React, { useEffect } from "react";
import { setAuthToken } from "@/lib/auth-utils";

const formSchema = z.object({
    email: z.string().email(),
    password: z.string().min(8),
});

const SignInForm = () => {
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
        temporarily_unavailable: "Google authentication is temporarily unavailable",
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

  const handleGoogleLogin = async () => {
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
      toast.error("Failed to initiate Google sign in");
    }
  };
  
    const [login, { loading }] = useMutation(SIGN_IN, {
        onCompleted: (data) => {
          const token = data.login.token;
          setAuthToken("Bearer", token);
          toast.success(data.login.message);
          router.push("/");
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
        },
    });

    const onSubmit = async (data: z.infer<typeof formSchema>) => {
        await login({ variables: { input: data } });
    };

  return (
    <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 mt-4 sm:mt-8">
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
                name="password"
                render={({ field }) => (
                    <FormItem className="space-y-1.5">
                        <FormLabel className="text-sm sm:text-base">Password</FormLabel>
                        <FormControl>
                            <Input 
                              className="h-9 sm:h-10 px-3"
                              type="password"
                              placeholder="Enter your password"
                              autoComplete="current-password"
                              disabled={loading}
                              {...field}
                            />
                        </FormControl>
                        <FormMessage className="text-xs sm:text-sm" />
                    </FormItem>
                )}
            />
            <Button 
              type="submit" 
              disabled={loading} 
              className="w-full h-9 sm:h-10 bg-gradient-custom text-white cursor-pointer text-sm sm:text-base mt-6"
            >
                {loading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                {loading ? "Signing in..." : "Sign in"}
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
                onClick={handleGoogleLogin}
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
                        "Sign in with Google"
                    )}
                </span>
            </Button>
        </form>
    </Form>
  )
}

export default SignInForm