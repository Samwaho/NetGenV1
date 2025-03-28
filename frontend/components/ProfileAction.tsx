"use client";

import React from "react";
import { useQuery } from "@apollo/client";
import { CURRENT_USER } from "@/graphql/auth";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { Separator } from "@/components/ui/separator";
import Link from "next/link";
import { Settings } from "lucide-react";
const ProfileAction = () => {
  const { data } = useQuery(CURRENT_USER);
  console.log(data?.currentUser);
  const userInitials =
    `${data?.currentUser.firstName[0]}${data?.currentUser.lastName[0]}`.toUpperCase();
  return (
    <Popover>
      <PopoverTrigger className="cursor-pointer">
        <Avatar>
          <AvatarImage src={data?.currentUser.avatar} />
          <AvatarFallback>{userInitials}</AvatarFallback>
        </Avatar>
      </PopoverTrigger>
      <PopoverContent className="w-fit">
        <div className="mb-3">
          <p className="font-semibold text-foreground">{`${data?.currentUser.firstName} ${data?.currentUser.lastName}`}</p>
          <p className="text-sm text-muted-foreground truncate">
            {data?.currentUser.email}
          </p>
        </div>
        <Separator className="my-2" />
        <div className="flex flex-col gap-2">
          <Link href="/settings" className="flex items-center gap-2 p-2 rounded-md hover:bg-muted">
              <Settings className="w-4 h-4" />
              Settings
          </Link>
          <button>Sign out</button>
        </div>
      </PopoverContent>
    </Popover>
  );
};

export default ProfileAction;
