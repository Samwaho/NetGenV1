'use client';

import { useEffect, useState } from 'react';
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Lock } from "lucide-react";
import Link from "next/link";
import { getAuthToken } from "@/lib/auth-utils";

export default function AuthCheck({ children }: { children: React.ReactNode }) {
  const [isAuthenticated, setIsAuthenticated] = useState(true); // Start with true to prevent flash
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const token = getAuthToken();
    setIsAuthenticated(!!token);
    setIsLoading(false);
  }, []);

  if (isLoading) {
    return null; // Or a loading spinner
  }

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen p-4 flex items-center justify-center">
        <Card className="max-w-md w-full glow transition-shadow duration-300">
          <CardContent className="p-6 space-y-6">
            <div className="flex flex-col items-center text-center space-y-4">
              <div className="p-3 bg-yellow-100 dark:bg-yellow-900/20 rounded-full">
                <Lock className="w-8 h-8 text-yellow-600 dark:text-yellow-400" />
              </div>
              
              <div className="space-y-2">
                <h2 className="text-2xl font-bold tracking-tight">
                  Session Expired
                </h2>
                <p className="text-muted-foreground">
                  Please sign in again to continue.
                </p>
              </div>

              <Link 
                href="/sign-in"
                className="w-full"
              >
                <Button 
                  variant="outline"
                  className="w-full" 
                  size="lg"
                >
                  Sign In
                </Button>
              </Link>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return children;
}