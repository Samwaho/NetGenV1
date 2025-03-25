const AuthLayout = ({ children }: { children: React.ReactNode }) => {
  return (
    <section className="flex min-h-[100dvh] items-center justify-center px-4 py-12">
      {children}
    </section>
  );
};

export default AuthLayout;
