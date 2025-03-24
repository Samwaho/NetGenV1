import { useMutation } from "@apollo/client";
import { toast } from "sonner";
import { useRouter } from "next/navigation";
import {
  GOOGLE_AUTH_URL_MUTATION,
  GOOGLE_CALLBACK_MUTATION,
  GoogleCallbackResponse,
} from "@/graphql/auth";
import { setAuthToken } from "@/lib/auth-utils";

export const useGoogleAuth = () => {
  const router = useRouter();

  const [getGoogleAuthUrl, { loading: googleAuthLoading }] = useMutation<
    { googleAuthUrl: string },
    void
  >(GOOGLE_AUTH_URL_MUTATION, {
    onError: (error) => {
      toast.error("Failed to initiate Google sign in");
      console.error("Google auth URL error:", error);
    },
  });

  const [handleGoogleCallback, { loading: googleCallbackLoading }] = useMutation<
    GoogleCallbackResponse,
    { code: string }
  >(GOOGLE_CALLBACK_MUTATION, {
    onCompleted: (data) => {
      try {
        if (data?.googleCallback?.token) {
          setAuthToken("Bearer", data.googleCallback.token);
          router.replace("/");
          router.refresh();
          toast.success("Successfully signed in with Google!");
        } else {
          throw new Error("No token received from Google authentication");
        }
      } catch (error) {
        console.error("Error setting auth token:", error);
        toast.error("Failed to complete authentication");
        router.replace("/sign-in");
      }
    },
    onError: (error) => {
      toast.error("Failed to complete Google authentication");
      console.error("Google callback error:", error);
      router.replace("/sign-in");
    },
  });

  return {
    getGoogleAuthUrl,
    handleGoogleCallback,
    googleAuthLoading,
    googleCallbackLoading,
  };
}; 