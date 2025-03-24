const AuthLayout = ({ children }: { children: React.ReactNode }) => {
  return (
    <section className="flex h-screen w-full items-center justify-center">
      {children}
    </section>
  );
};

export default AuthLayout;
