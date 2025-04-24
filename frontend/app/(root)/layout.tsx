import Header from "@/components/Header";
import { Separator } from "@/components/ui/separator";

const RootLayout = ({ children }: { children: React.ReactNode }) => {
  return (
    <main className="flex min-h-screen flex-col items-center px-2 sm:px-4 md:px-6 lg:px-8">
      <Header />
      <Separator className="bg-slate-300 dark:bg-slate-800 w-full" />
      <div className="w-full max-w-7xl">
        {children}
      </div>
    </main>
  );
};

export default RootLayout;
