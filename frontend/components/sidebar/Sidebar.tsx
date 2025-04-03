"use client";

import {
  Command,
  CommandEmpty,
  CommandInput,
  CommandItem,
  CommandList,
} from "../ui/command";
import { sidebarData } from "@/lib/constants";
import { usePathname } from "next/navigation";
import Link from "next/link";

interface SidebarProps {
  loggedInUser?: {
    id: string;
    email: string;
    firstName: string;
    lastName: string;
    profileImage?: string;
    username: string;
    role: string;
    name?: string;
  };
}

const Sidebar: React.FC<SidebarProps> = ({ loggedInUser }) => {
  const pathname = usePathname();
 

  return (
    <div className="h-[95dvh] bg-card shadow-md dark:border  p-6 flex-1 rounded-3xl hidden md:flex flex-col justify-between transition-all duration-300 hover:shadow-xl">
      <div>
        <div className="-ms-2">
          <Command>
            <CommandInput
              placeholder="Search menu item..."
              className="border-none"
            />

            <CommandList className="mt-4">
              <CommandEmpty>No results found.</CommandEmpty>
              {sidebarData.map((item) => (
                <CommandItem
                  key={item.title}
                  className="py-2 px-1 hover:bg-fuchsia-100 dark:hover:bg-fuchsia-900/20 rounded-md transition-colors"
                >
                  <Link
                    className="flex items-center gap-4 w-full"
                    href={item.path}
                  >
                    <i
                      className={`p-1 rounded-md shadow-md text-white transition-all duration-300 ${
                        (item.path === "/isp" && pathname === "/isp") || 
                        (item.path !== "/isp" && pathname.startsWith(item.path))
                          ? "bg-gradient-custom scale-110"
                          : "bg-gradient-custom2 hover:scale-105"
                      }`}
                    >
                      <item.icon className="size-4" />
                    </i>
                    <p
                      className={`text-md font-medium ${
                        (item.path === "/isp" && pathname === "/isp") || 
                        (item.path !== "/isp" && pathname.startsWith(item.path))
                          ? "text-fuchsia-600 dark:text-fuchsia-400"
                          : "text-muted-foreground"
                      }`}
                    >
                      {item.title}
                    </p>
                  </Link>
                </CommandItem>
              ))}
            </CommandList>
          </Command>
        </div>
      </div>

    </div>
  );
};

export default Sidebar;
