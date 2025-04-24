import IspHeader from "@/components/IspHeader";
import Sidebar from "@/components/sidebar/Sidebar";
import MobileSidebar from "@/components/sidebar/MobileSidebar";
import { Separator } from "@/components/ui/separator";
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
      <div className="min-h-screen flex flex-col lg:flex-row">
        {/* Desktop Sidebar - hidden on mobile */}
        <aside className="hidden lg:block lg:w-[18%] xl:w-[14%] lg:fixed lg:top-4 lg:left-4 lg:h-screen lg:border-r lg:border-border">
          <Sidebar organizationId={organizationId} />
        </aside>

        {/* Main Content */}
        <main className="w-full lg:w-[82%] xl:w-[86%] lg:ml-[18%] xl:ml-[14%]">
          <div className="p-2 sm:p-4 md:p-6">
            <div className="flex items-center justify-between gap-2 sm:gap-4">
              <div className="lg:hidden">
                <MobileSidebar organizationId={organizationId} />
              </div>
              <div className="flex-1">
                <IspHeader organizationId={organizationId} />
              </div>
            </div>
            <Separator className="bg-slate-300 dark:bg-slate-800" />
            <div className="mt-1 sm:mt-4">{children}</div>
          </div>
        </main>
      </div>
    </AuthCheck>
  );
}
