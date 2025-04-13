import Header from "@/components/Header";
import Sidebar from "@/components/sidebar/Sidebar";
import MobileSidebar from "@/components/sidebar/MobileSidebar";
import { Separator } from "@/components/ui/separator";
import { client } from "@/lib/apollo-client";
import { GET_SUBSCRIPTIONS } from "@/graphql/subscription";
import { GET_ORGANIZATION } from "@/graphql/organization";
import { cookies } from "next/headers";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import Link from "next/link";
import { AlertCircle, Lock } from "lucide-react";
import { redirect } from "next/navigation";
import { hasOrganizationPermissions } from "@/lib/permission-utils";
import { OrganizationPermissions } from "@/lib/permissions";
import { jwtDecode } from "jwt-decode";
import AuthCheck from "@/components/auth/AuthCheck";

export default async function ISPLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: { id: string };
}) {
  const resolvedParams = await params;
  const organizationId = resolvedParams.id;

  return (
    <AuthCheck>
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
    </AuthCheck>
  );
}
