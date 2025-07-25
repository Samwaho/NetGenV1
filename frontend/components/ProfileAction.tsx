"use client";

import React from "react";
import { useQuery, useApolloClient } from "@apollo/client";
import { CURRENT_USER } from "@/graphql/auth";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { Separator } from "@/components/ui/separator";
import Link from "next/link";
import {  LogIn, User, DollarSign, Building2, Home } from "lucide-react";
import { Button } from "@/components/ui/button";
import { removeAuthToken } from "@/lib/auth-utils";
import { useRouter } from "next/navigation";

const ProfileAction = () => {
  const { data, loading, error } = useQuery(CURRENT_USER, {
    fetchPolicy: 'network-only',
  });
  const currentUser = data?.currentUser;
  const router = useRouter();
  const client = useApolloClient();

  if (loading) {
    return (
      <Avatar>
        <AvatarFallback className="text-sm font-semibold text-center uppercase bg-gradient-custom text-white">
          ...
        </AvatarFallback>
      </Avatar>
    );
  }

  if (error || !currentUser) {
    return (
      <Link href="/sign-in">
        <Button className="flex items-center gap-2 bg-gradient-custom text-white cursor-pointer">
          <LogIn className="w-4 h-4" />
          Sign in
        </Button>
      </Link>
    );
  }

  const userInitials =
    `${currentUser.firstName?.[0] || ""}${currentUser.lastName?.[0] || ""}`.toUpperCase() || "U";

  return (
    <Popover>
      <PopoverTrigger className="cursor-pointer">
        <Avatar>
          <AvatarImage src={currentUser.avatar} />
          <AvatarFallback className="text-sm font-semibold text-center uppercase bg-gradient-custom text-white">
            {userInitials}
          </AvatarFallback>
        </Avatar>
      </PopoverTrigger>
      <PopoverContent className="w-fit">
        <div className="mb-3">
          <p className="font-semibold text-foreground">{`${currentUser.firstName || ""} ${currentUser.lastName || ""}`}</p>
          <p className="text-sm text-muted-foreground truncate">
            {currentUser.email}
          </p>
        </div>
        <Separator className="my-2" />
        <div className="flex flex-col gap-2">
          <Link
            href="/"
            className="flex items-center gap-2 p-2 rounded-md hover:bg-muted"
          >
            <Home className="w-4 h-4" />
            Home
          </Link>
          <Link
            href="/profile"
            className="flex items-center gap-2 p-2 rounded-md hover:bg-muted"
          >
            <User className="w-4 h-4" />
            Profile
          </Link>
          <Link
            href="/pricing"
            className="flex items-center gap-2 p-2 rounded-md hover:bg-muted"
          >
            <DollarSign className="w-4 h-4" />
            Pricing
          </Link>
          <Link
            href="/organizations"
            className="flex items-center gap-2 p-2 rounded-md hover:bg-muted"
          >
            <Building2 className="w-4 h-4" />
            Organizations
          </Link>
          <Button
            className="w-full h-8 sm:h-8 bg-transparent border border-red-500 hover:bg-red-50 dark:hover:bg-transparent dark:hover:border-red-300 text-red-500 cursor-pointer"
            onClick={async () => {
              removeAuthToken();
              await client.clearStore();
              router.push("/");
            }}
          >
            Sign out
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
};

export default ProfileAction;
