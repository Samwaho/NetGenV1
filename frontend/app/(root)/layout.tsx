import Header from "@/components/Header";
import { Separator } from "@/components/ui/separator";

const RootLayout = ({ children }: { children: React.ReactNode }) => {
  return (
    <main className="flex min-h-screen flex-col items-center px-8">
      <Header />
      <Separator className=" bg-slate-300 dark:bg-slate-800" />
      {children}
    </main>
  );
};

export default RootLayout;
