import Header from "@/components/Header";
import Sidebar from "@/components/sidebar/Sidebar";
import MobileSidebar from "@/components/sidebar/MobileSidebar";

export default function ISPLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: { id: string };
}) {
  return (
    <div className="min-h-screen flex flex-col lg:flex-row lg:gap-4 lg:p-4">
      {/* Desktop Sidebar - hidden on mobile */}
      <aside className="w-full lg:w-[18%] xl:w-[14%] lg:fixed lg:top-4 lg:left-4 lg:h-[calc(100vh-2rem)]">
        <Sidebar organizationId={params.id} />
      </aside>
      
      {/* Main Content */}
      <main className="w-full lg:w-[82%] xl:w-[86%] lg:ml-auto overflow-y-auto">
        <div className="p-4">
          <div className="flex items-center gap-4">
            <div className="md:hidden">
              <MobileSidebar organizationId={params.id} />
            </div>
            <Header />
          </div>
          <div className="mt-4">{children}</div>
        </div>
      </main>
    </div>
  );
}
