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

  const handleGoogleLogin = async () => {
    try {
      const { data } = await getGoogleAuthUrl();
      if (data?.googleAuthUrl) {
        window.location.href = data.googleAuthUrl;
      } else {
        toast.error("Failed to get Google authentication URL");
      }
    } catch (error) {
      toast.error("Failed to initiate Google sign in");
      console.error("Google auth error:", error);
    }
  };

  useEffect(() => {
    const code = searchParams.get("code");
    const state = searchParams.get("state");

    if (code && state === "google-auth" && !codeProcessed.current) {
      codeProcessed.current = true; // Mark this code as processed
      handleGoogleCallback({
        variables: { code },
      });
    }
  }, [searchParams, handleGoogleCallback]);
    const [login, { loading }] = useMutation(SIGN_IN, {
        onCompleted: (data) => {
            if (data.login.success) {
                toast.success(data.login.message);
                router.push("/");
            } else {
                toast.error(data.login.message);
            }
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
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 sm:space-y-6 mt-4 sm:mt-8">
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
                className="w-full h-9 sm:h-10 flex items-center justify-center space-x-2 bg-gradient-custom2 cursor-pointer text-sm sm:text-base"
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