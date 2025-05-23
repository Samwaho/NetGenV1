"use client";

import { useState } from "react";
import { MoreHorizontal, Pencil, Trash } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ISPStation } from "@/types/isp_station";
import { useMutation } from "@apollo/client";
import { DELETE_ISP_STATION } from "@/graphql/isp_stations";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { toast } from "sonner";
import { useRouter, useParams } from "next/navigation";

interface StationActionsProps {
  station: ISPStation;
  organizationId?: string;
}

export function StationActions({ station, organizationId: propOrgId }: StationActionsProps) {
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const router = useRouter();
  const params = useParams();
  
  // Use organizationId from props or fallback to params
  const organizationId = propOrgId || params?.id;

  const [deleteStation, { loading: isDeleting }] = useMutation(DELETE_ISP_STATION, {
    refetchQueries: ["GetISPStations"],
    onCompleted: (data) => {
      if (data.deleteStation.success) {
        toast.success("Station deleted successfully");
        setIsDeleteDialogOpen(false);
      } else {
        toast.error("Failed to delete station");
      }
    },
    onError: (error) => {
      toast.error(error.message || "Failed to delete station");
    },
  });

  // Validate organizationId
  if (!organizationId) {
    console.error("Organization ID is missing");
    return null;
  }

  const handleDelete = async () => {
    if (!station.id) {
      toast.error("Invalid station ID");
      return;
    }

    try {
      await deleteStation({
        variables: {
          id: station.id,
        },
      });
    } catch (error) {
      // Error is handled by onError above
    }
  };

  const handleEdit = () => {
    if (!organizationId || !station.id) {
      toast.error("Missing required information");
      return;
    }
    router.push(`/${organizationId}/isp/stations/${station.id}/edit`);
  };

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" className="h-8 w-8 p-0">
            <span className="sr-only">Open menu</span>
            <MoreHorizontal className="h-4 w-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem onClick={handleEdit}>
            <Pencil className="mr-2 h-4 w-4" />
            Edit
          </DropdownMenuItem>
          <DropdownMenuItem 
            onClick={() => setIsDeleteDialogOpen(true)}
            className="text-red-600"
          >
            <Trash className="mr-2 h-4 w-4" />
            Delete
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you sure?</AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone. This will permanently delete the station
              and all associated data.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              className="bg-red-600 hover:bg-red-700"
              disabled={isDeleting}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}


