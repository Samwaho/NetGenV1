import Header from "@/components/Header";

const RootLayout = ({ children }: { children: React.ReactNode }) => {
  return (
    <main className="flex min-h-screen flex-col px-8">
      <Header />
      {children}
    </main>
  );
};

export default RootLayout;
