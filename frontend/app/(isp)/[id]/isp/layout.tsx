import Header from "@/components/Header";
import Sidebar from "@/components/sidebar/Sidebar";
import MobileSidebar from "@/components/sidebar/MobileSidebar";
import { Separator } from "@/components/ui/separator";
import { client } from "@/lib/apollo-client";
import { GET_SUBSCRIPTIONS } from "@/graphql/subscription";
import { cookies } from "next/headers";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import Link from "next/link";
import { AlertCircle } from "lucide-react";
import { redirect } from "next/navigation";

export default async function ISPLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: { id: string };
}) {
  const resolvedParams = await params;
  const organizationId = resolvedParams.id;

  // Get auth token from cookies
  const cookieStore = await cookies();
  const token = cookieStore.get('token')?.value;

  if (!token) {
    redirect('/sign-in');
  }

  // Check for active subscription
  const { data } = await client.query({
    query: GET_SUBSCRIPTIONS,
    context: {
      headers: {
        authorization: token
      }
    }
  });

  const hasActiveSubscription = data?.subscriptions?.subscriptions?.some(
    (sub: { status: string; organization: { id: string } }) => 
      sub.status === "ACTIVE" && sub.organization.id === organizationId
  );

  if (!hasActiveSubscription) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-background to-muted p-4 flex items-center justify-center">
        <Card className="max-w-md w-full glow transition-shadow duration-300">
          <CardContent className="p-6 space-y-6">
            <div className="flex flex-col items-center text-center space-y-4">
              <div className="p-3 bg-red-100 dark:bg-red-900/20 rounded-full">
                <AlertCircle className="w-8 h-8 text-red-600 dark:text-red-400" />
              </div>
              
              <div className="space-y-2">
                <h2 className="text-2xl font-bold tracking-tight">
                  No Active Subscription
                </h2>
                <p className="text-muted-foreground">
                  You need an active subscription to access ISP features.
                  Please subscribe to continue using our services.
                </p>
              </div>

              <div className="flex flex-col sm:flex-row gap-3 w-full">
                <Link 
                  href={`/pricing`}
                  className="w-full"
                >
                  <Button 
                    className="w-full bg-gradient-to-r from-purple-600 to-fuchsia-600 hover:from-purple-700 hover:to-fuchsia-700 text-white"
                    size="lg"
                  >
                    View Plans
                  </Button>
                </Link>
                <Link 
                  href={`/organizations/${organizationId}`}
                  className="w-full"
                >
                  <Button 
                    variant="outline"
                    className="w-full" 
                    size="lg"
                  >
                    Back to Dashboard
                  </Button>
                </Link>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col lg:flex-row lg:gap-4 lg:p-4">
      {/* Desktop Sidebar - hidden on mobile */}
      <aside className="w-full lg:w-[18%] xl:w-[14%] lg:fixed lg:top-4 lg:left-4 lg:h-[calc(100vh-2rem)]">
        <Sidebar organizationId={organizationId} />
      </aside>

      {/* Main Content */}
      <main className="w-full lg:w-[82%] xl:w-[86%] lg:ml-auto overflow-y-auto">
        <div className="p-4">
          <div className="flex items-center gap-4">
            <div className="md:hidden">
              <MobileSidebar organizationId={organizationId} />
            </div>
            <Header />
          </div>
          <Separator className="bg-slate-300 dark:bg-slate-800" />
          <div className="mt-4">{children}</div>
        </div>
      </main>
    </div>
  );
}
