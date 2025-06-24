"use client";

import { useQuery, useMutation } from "@apollo/client";
import { GET_ACTIVITIES } from "@/graphql/activity";
import { CLEAR_OLD_ACTIVITIES } from "@/graphql/activity";
import { Card, CardContent } from "@/components/ui/card";
import { AlertCircle } from "lucide-react";
import { useState, useMemo, useCallback } from "react";
import { toast } from "sonner";
import { hasOrganizationPermissions } from "@/lib/permission-utils";
import { OrganizationPermissions } from "@/lib/permissions";
import { Organization } from "@/types/organization";
import { DataTable } from "./ActivityTable";
import { columns } from "./activityColumns";
import { TableSkeleton } from "@/components/TableSkeleton";


type ActivityTabProps = {
  organizationId: string;
  organization: Organization;
  currentUserId: string;
};

export const ActivityTab = ({ organizationId, organization, currentUserId }: ActivityTabProps) => {
  const [filterOptions, setFilterOptions] = useState({
    page: 1,
    pageSize: 20,
    timeFilter: "all",
    search: "",
  });

  const { data, loading } = useQuery(GET_ACTIVITIES, {
    variables: {
      organizationId,
      limit: filterOptions.pageSize,
      skip: (filterOptions.page - 1) * filterOptions.pageSize,
      search: filterOptions.search,
      timeFilter: filterOptions.timeFilter,
    },
    skip: !organizationId,
    fetchPolicy: "cache-and-network",
    nextFetchPolicy: "cache-first",
    notifyOnNetworkStatusChange: true,
  });

  const [clearOldActivities, { loading: clearing }] = useMutation(CLEAR_OLD_ACTIVITIES, {
    onCompleted: (data) => {
      if (data.clearOldActivities.success) {
        toast.success(data.clearOldActivities.message);
      } else {
        toast.error(data.clearOldActivities.message);
      }
    },
    onError: (error) => {
      toast.error(error.message);
    },
    refetchQueries: [
      { query: GET_ACTIVITIES, variables: { organizationId, limit: 100, skip: 0 } },
    ],
  });

  const activities = useMemo(() => data?.activities?.activities || [], [data?.activities?.activities]);
  const totalCount = data?.activities?.total_count || 0;

  const canViewActivity = hasOrganizationPermissions(
    organization,
    currentUserId,
    OrganizationPermissions.VIEW_ACTIVITY
  );
  const canClearActivity = hasOrganizationPermissions(
    organization,
    currentUserId,
    OrganizationPermissions.CLEAR_ACTIVITY
  );

  // Handler for filter changes from DataTable
  const handleFilterChange = useCallback((newFilters: Partial<typeof filterOptions>) => {
    setFilterOptions((prev) => ({ ...prev, ...newFilters }));
  }, []);

  if (!canViewActivity) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="flex items-center justify-center text-muted-foreground py-8">
            <AlertCircle className="h-5 w-5 mr-2" />
            <p>You do not have permission to view activities.</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (loading) {
    return <TableSkeleton columns={3} rows={5} />;
  }

  return (
    <div className="overflow-x-auto p-2 sm:p-4 bg-card rounded-2xl shadow-md dark:border">
      <DataTable
        columns={columns}
        data={activities}
        totalCount={totalCount}
        filterOptions={filterOptions}
        onFilterChange={handleFilterChange}
        isLoading={loading}
        canClearActivity={canClearActivity}
        onClearOldActivities={() => clearOldActivities({ variables: { days: 90 } })}
        clearing={clearing}
      />
    </div>
  );
};





