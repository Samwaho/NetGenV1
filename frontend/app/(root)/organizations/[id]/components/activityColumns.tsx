import { ColumnDef } from "@tanstack/react-table";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { formatDateToNowInTimezone } from "@/lib/utils";
import { Clock } from "lucide-react";

export type Activity = {
  id: string;
  action: string;
  userDetails: {
    firstName: string;
    lastName: string;
    email: string;
    role: string;
  } | null;
  organization: {
    id: string;
    name: string;
  };
  createdAt: string;
};

export const columns: ColumnDef<Activity>[] = [
  {
    accessorFn: (row) => row.userDetails ? `${row.userDetails.firstName} ${row.userDetails.lastName}` : 'Deleted User',
    id: "user",
    header: "User",
    cell: ({ row }) => {
      const activity = row.original;
      if (!activity.userDetails) {
        return (
          <div className="flex items-center space-x-3">
            <Avatar className="h-8 w-8">
              <AvatarFallback className="bg-muted">DU</AvatarFallback>
            </Avatar>
            <div>
              <p className="font-medium text-sm text-muted-foreground">Deleted User</p>
            </div>
          </div>
        );
      }
      return (
        <div className="flex items-center space-x-3 ">
          <Avatar className="h-8 w-8">
            <AvatarImage src={`https://avatar.vercel.sh/${activity.userDetails.email}`} />
            <AvatarFallback>
              {`${activity.userDetails.firstName?.[0] || ""}${activity.userDetails.lastName?.[0] || ""}`}
            </AvatarFallback>
          </Avatar>
          <div>
            <p className="font-medium text-sm">
              {(activity.userDetails.firstName || "") + " " + (activity.userDetails.lastName || "")}
            </p>
            <p className="text-xs text-muted-foreground">
              {activity.userDetails.email}
            </p>
          </div>
        </div>
      );
    },
  },
  {
    accessorKey: "action",
    header: "Action",
    cell: ({ row }) => (
      <div className="text-sm">{row.original.action}</div>
    ),
  },
  {
    accessorKey: "createdAt",
    header: "Time",
    cell: ({ row }) => (
      <div className="flex items-center text-xs text-muted-foreground">
        <Clock className="h-3 w-3 mr-1" />
        {formatDateToNowInTimezone(row.original.createdAt)}
      </div>
    ),
  },
]; 