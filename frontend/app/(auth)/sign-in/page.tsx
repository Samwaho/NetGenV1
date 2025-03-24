import Link from "next/link";
import { FaLock } from "react-icons/fa";
import SignInForm from "./SignInForm";

const Page = () => {
  return (
    <div className="flex min-h-full items-center justify-center px-4 py-12 sm:px-6 lg:px-8">
      <div className="w-full max-w-md space-y-8 p-4 sm:p-8 bg-card rounded-lg glow">
        <div className="mx-auto h-12 w-12 rounded-full bg-fuchsia-100 flex items-center justify-center">
          <FaLock className="h-6 w-6 text-fuchsia-600" />
        </div>
        <h2 className="mt-6 text-center text-3xl font-bold tracking-tight text-gray-900 dark:text-gray-50">
          Sign in to your account
        </h2>
        <p className="mt-2 text-center text-sm text-gray-600 dark:text-gray-400">
          Or{" "}
          <Link
            className="font-medium text-fuchsia-600 hover:text-fuchsia-500 dark:text-fuchsia-400 dark:hover:text-fuchsia-300 transition-colors duration-200"
            href="/sign-up"
          >
            sign up for a new account
          </Link>
          {" · "}
          <Link
            className="font-medium text-fuchsia-600 hover:text-fuchsia-500 dark:text-fuchsia-400 dark:hover:text-fuchsia-300 transition-colors duration-200"
            href="/forgot-password"
          >
            Forgot password?
          </Link>
        </p>
        <SignInForm />
      </div>
    </div>
  );
};

export default Page;
