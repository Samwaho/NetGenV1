import { Building2 } from "lucide-react";
import CreateOrganizationForm from "./CreateOrganizationForm";

const Page = () => {
  return (
    <div className="w-full max-w-4xl space-y-6 p-4 sm:p-8 bg-card rounded-lg glow mx-auto mt-8 mb-8">
      <div className="text-center">
        <div className="mx-auto h-12 w-12 rounded-full bg-fuchsia-100 flex items-center justify-center">
          <Building2 className="h-6 w-6 text-fuchsia-600" />
        </div>
        <h2 className="mt-6 text-center text-3xl font-bold tracking-tight text-gray-900 dark:text-gray-50">
          Create New Organization
        </h2>
        <p className="mt-2 text-center text-sm text-gray-600 dark:text-gray-400">
          Set up a new organization to collaborate with your team
        </p>
      </div>
      <CreateOrganizationForm />
    </div>
  );
};

export default Page;