import { useMutation } from "@apollo/client";
import { toast } from "sonner";
import { useRouter } from "next/navigation";
import {
  GOOGLE_AUTH_URL,
  GOOGLE_CALLBACK,
  GoogleCallbackResponse,
} from "@/graphql/auth";
import { setAuthToken } from "@/lib/auth-utils";

export const useGoogleAuth = () => {
  const router = useRouter();

  const [getGoogleAuthUrl, { loading: googleAuthLoading }] = useMutation<
    { googleAuthUrl: string },
    void
  >(GOOGLE_AUTH_URL, {
    onError: (error) => {
      console.error("Google auth URL error:", error);
      toast.error("Failed to initiate Google sign in");
    },
  });

  const [handleGoogleCallback, { loading: googleCallbackLoading }] = useMutation<
    GoogleCallbackResponse,
    { code: string }
  >(GOOGLE_CALLBACK, {
    onCompleted: (data) => {
      console.log("Google callback response:", data);
      try {
        const response = data?.googleAuthCallback;
        if (response?.success && response?.token) {
          setAuthToken("Bearer", response.token);
          toast.success(response.message || "Successfully signed in with Google");
          router.push("/");
          router.refresh();
        } else {
          throw new Error(response?.message || "Authentication failed");
        }
      } catch (error) {
        console.error("Error processing Google callback:", error);
        toast.error(error instanceof Error ? error.message : "Failed to complete authentication");
        router.push("/sign-in");
      }
    },
    onError: (error) => {
      console.error("Google callback error:", error);
      toast.error(error.message || "Failed to complete Google authentication");
      router.push("/sign-in");
    },
  });

  return {
    getGoogleAuthUrl,
    handleGoogleCallback,
    googleAuthLoading,
    googleCallbackLoading,
  };
}; 