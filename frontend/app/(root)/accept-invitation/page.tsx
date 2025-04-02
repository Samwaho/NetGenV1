"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useMutation } from "@apollo/client";
import { ACCEPT_INVITATION } from "@/graphql/organization";
import { toast } from "sonner";
import { MdOutlineCheckCircle, MdErrorOutline } from "react-icons/md";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const Page = () => {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [noToken, setNoToken] = useState(false);

  const [acceptInvitation, { loading, error, data }] = useMutation(ACCEPT_INVITATION, {
    onCompleted: (data) => {
      toast.success(data.acceptInvitation.message);
    },
    onError: (error) => {
      toast.error(error.message);
    },
  });

  useEffect(() => {
    const token = searchParams.get("token");
    
    if (!token) {
      setNoToken(true);
      return;
    }

    acceptInvitation({
      variables: {
        token: token,
      },
    });
  }, [searchParams, acceptInvitation]);

  const errorMessage = noToken 
    ? "No invitation token found. Please make sure you're using the correct invitation link."
    : error?.message || "Failed to accept invitation. The link might be expired or invalid.";

  return (
    <div className="max-w-md mx-auto space-y-4 p-4 sm:p-8 bg-card rounded-lg glow">
      <div className="flex items-center justify-center">
        <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center">
          {loading && (
            <div className="h-6 w-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
          )}
          {data && (
            <MdOutlineCheckCircle className="h-6 w-6 text-primary" />
          )}
          {(error || noToken) && (
            <MdErrorOutline className="h-6 w-6 text-destructive" />
          )}
        </div>
      </div>

      <h2 className="text-3xl font-bold tracking-tight text-foreground text-center">
        {loading && "Accepting Invitation"}
        {data && "Welcome to the Organization!"}
        {(error || noToken) && "Invitation Error"}
      </h2>

      <p className="text-muted-foreground text-center">
        {loading && "Please wait while we process your invitation..."}
        {data && (
          <>
            You have successfully joined{" "}
            <span className="font-semibold text-foreground">
              {data.acceptInvitation.organization.name}
            </span>
          </>
        )}
        {(error || noToken) && errorMessage}
      </p>

      <div className="space-y-3 pt-4">
        {data && (
          <Button
            onClick={() => router.push(`/organizations/${data.acceptInvitation.organization.id}`)}
            className={cn(
              "w-full h-9 sm:h-10 bg-gradient-custom hover:opacity-80 text-white",
              "transition-all duration-200"
            )}
          >
            Go to Organization
          </Button>
        )}
        
        <Button
          onClick={() => router.push("/dashboard")}
          className={cn(
            "w-full h-9 sm:h-10",
            data ? "bg-gradient-custom2" : "bg-gradient-custom",
            "hover:opacity-80 text-white transition-all duration-200"
          )}
        >
          {data ? "Back to Dashboard" : "Go to Dashboard"}
        </Button>
      </div>
    </div>
  );
};

export default Page;