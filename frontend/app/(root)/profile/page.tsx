"use client";
import { useQuery } from "@apollo/client";
import { CURRENT_USER } from "@/graphql/auth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { User, Mail, Building2, Calendar } from "lucide-react";
import { toast } from "sonner";

// Helper function to format date
const formatDate = (dateString: string) => {
  try {
    const date = new Date(dateString);
    if (isNaN(date.getTime())) {
      return "N/A";
    }
    return date.toLocaleDateString("en-US", {
      year: "numeric",
      month: "long",
      day: "numeric",
    });
  } catch (error) {
    console.error("Date formatting error:", error);
    return "N/A";
  }
};

export default function ProfilePage() {
  const { data, loading, error } = useQuery(CURRENT_USER);
  if (loading) {
    return (
      <div className="container mx-auto px-4 py-16 max-w-3xl">
        {" "}
        <div className="text-center mb-8">
          <Skeleton className="h-10 w-64 mx-auto mb-4" />{" "}
          <Skeleton className="h-6 w-96 mx-auto" />
        </div>{" "}
        <Card>
          <CardHeader>
            {" "}
            <Skeleton className="h-8 w-32 mb-2" />
          </CardHeader>{" "}
          <CardContent className="space-y-6">
            {[1, 2, 3, 4].map((i) => (
              <Skeleton key={i} className="h-12 w-full" />
            ))}{" "}
          </CardContent>
        </Card>{" "}
      </div>
    );
  }
  if (error || !data?.currentUser) {
    toast.error("Failed to load profile");
    return (
      <div className="container mx-auto px-4 py-16 text-center">
        {" "}
        <p className="text-red-500">
          Failed to load profile. Please try again later.{" "}
        </p>
      </div>
    );
  }
  const { currentUser } = data;
  
  // Safely get the organizations count
  const organizationsCount = currentUser?.organizations?.length || 0;
  const organizationsText = organizationsCount === 1 
    ? "1 organization" 
    : `${organizationsCount} organizations`;

  return (
    <div className="container mx-auto px-4 py-16 max-w-3xl">
      <div className="text-center mb-8">
        {" "}
        <h1 className="text-4xl font-bold tracking-tight mb-4 text-gradient-custom">
          Your Profile{" "}
        </h1>
        <p className="text-xl text-muted-foreground">
          {" "}
          Manage your personal information and settings
        </p>{" "}
      </div>
      <Card className="glow">
        <CardHeader>
          {" "}
          <CardTitle className="text-2xl text-gradient-custom2">
            Personal Information{" "}
          </CardTitle>
        </CardHeader>{" "}
        <CardContent className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {" "}
            <div className="space-y-2">
              <Label>First Name</Label>{" "}
              <div className="relative">
                <User className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />{" "}
                <Input
                  className="pl-9"
                  value={currentUser.firstName || ""}
                  disabled
                />
              </div>{" "}
            </div>
            <div className="space-y-2">
              <Label>Last Name</Label>{" "}
              <div className="relative">
                <User className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />{" "}
                <Input
                  className="pl-9"
                  value={currentUser.lastName || ""}
                  disabled
                />
              </div>{" "}
            </div>
            <div className="space-y-2">
              <Label>Email</Label>{" "}
              <div className="relative">
                <Mail className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />{" "}
                <Input
                  className="pl-9"
                  value={currentUser.email || ""}
                  disabled
                />
              </div>{" "}
            </div>
            <div className="space-y-2">
              <Label>Organizations</Label>{" "}
              <div className="relative">
                <Building2 className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />{" "}
                <Input
                  className="pl-9"
                  value={organizationsText}
                  disabled
                />
              </div>{" "}
            </div>
            
          </div>
          <div className="flex justify-end gap-4 pt-4">
            <Button
              className="bg-gradient-custom text-white hover:text-white"
              onClick={() => toast.info("Feature coming soon!")}
            >
              {" "}
              Edit Profile
            </Button>{" "}
          </div>
        </CardContent>{" "}
      </Card>
    </div>
  );
}
