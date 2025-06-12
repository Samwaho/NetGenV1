"use client";

import {
  Drawer,
  DrawerClose,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
  DrawerTrigger,
} from "@/components/ui/drawer";
import {
  Command,
  CommandEmpty,
  CommandInput,
  CommandItem,
  CommandList,
} from "../ui/command";
import { sidebarData } from "@/lib/constants";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Menu, X } from "lucide-react";

interface MobileSidebarProps {
  organizationId: string;
}

const MobileSidebar: React.FC<MobileSidebarProps> = ({ organizationId }) => {
  const pathname = usePathname();

  return (
    <Drawer direction="left">
      <DrawerTrigger>
        <Menu className="cursor-pointer size-8 text-muted-foreground hover:text-fuchsia-500 transition-colors" />
      </DrawerTrigger>
      <DrawerContent className="h-full w-[80vw] p-0">
        <div className="flex flex-col justify-between h-full bg-card">
          <div>
            <DrawerHeader className="flex justify-between items-center px-6 pt-6">
              <DrawerTitle>
                <span className="text-2xl font-bold tracking-wider text-gradient-custom">
                  ISPinnacle
                </span>
              </DrawerTitle>
              <DrawerClose>
                <X className="cursor-pointer size-6 text-muted-foreground hover:text-fuchsia-500 transition-colors" />
              </DrawerClose>
            </DrawerHeader>
            <div className="px-4 py-2">
              <Command className="bg-transparent">
                <CommandInput
                  placeholder="Search menu item..."
                  className="border-none"
                />

                <CommandList className="mt-4">
                  <CommandEmpty>No results found.</CommandEmpty>
                  {sidebarData.map((item) => {
                    const itemPath = item.path(organizationId);
                    const isActive = 
                      (itemPath === `/${organizationId}/isp` && pathname === `/${organizationId}/isp`) || 
                      (itemPath !== `/${organizationId}/isp` && pathname.startsWith(itemPath));

                    return (
                      <CommandItem
                        key={item.title}
                        className="py-2 px-1 hover:bg-fuchsia-100 dark:hover:bg-fuchsia-900/20 rounded-md transition-colors"
                      >
                        <Link
                          className="flex items-center gap-4 w-full"
                          href={itemPath}
                        >
                          <i
                            className={`p-1 rounded-md shadow-md text-white transition-all duration-300 ${
                              isActive
                                ? "bg-gradient-custom scale-110"
                                : "bg-gradient-custom2 hover:scale-105"
                            }`}
                          >
                            <item.icon className="size-4" />
                          </i>
                          <p
                            className={`text-md font-medium ${
                              isActive
                                ? "text-gradient-custom"
                                : "text-muted-foreground"
                            }`}
                          >
                            {item.title}
                          </p>
                        </Link>
                      </CommandItem>
                    );
                  })}
                </CommandList>
              </Command>
            </div>
          </div>
        </div>
      </DrawerContent>
    </Drawer>
  );
};

export default MobileSidebar;
