"use client";

import { useQuery } from "@apollo/client";
import { GET_ACTIVITIES } from "@/graphql/activity";
import { Card, CardContent } from "@/components/ui/card";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { formatDateToNowInTimezone } from "@/lib/utils";

type Activity = {
  id: string;
  action: string;
  user: {
    id: string;
    firstName: string;
    lastName: string;
    email: string;
  };
  organization: {
    id: string;
    name: string;
  };
  createdAt: string;
};

type ActivityTabProps = {
  organizationId: string;
};

export const ActivityTab = ({ organizationId }: ActivityTabProps) => {
  const { data, loading, error } = useQuery(GET_ACTIVITIES, {
    variables: { organizationId },
    skip: !organizationId,
  });

  if (!organizationId) {
    return (
      <Card>
        <CardContent className="p-6">
          <p className="text-muted-foreground text-center py-8">
            Organization ID is required
          </p>
        </CardContent>
      </Card>
    );
  }

  if (loading) {
    return (
      <Card>
        <CardContent className="p-6">
          <p className="text-muted-foreground text-center py-8">Loading...</p>
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card>
        <CardContent className="p-6">
          <p className="text-muted-foreground text-center py-8">
            Error loading activities
          </p>
        </CardContent>
      </Card>
    );
  }

  // Correctly access the activities array from the response
  const activities = data?.activities?.activities || [];

  // If no activities, show a message
  if (activities.length === 0) {
    return (
      <Card>
        <CardContent className="p-6">
          <p className="text-muted-foreground text-center py-8">
            No activities found
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div>
      <Card>
        <CardContent className="p-0">
          <div className="divide-y divide-border">
            {activities.map((activity: Activity) => (
              <div
                key={activity.id}
                className="flex items-center space-x-4 p-4 hover:bg-muted/50"
              >
                <Avatar className="h-9 w-9">
                  <AvatarFallback>
                    {`${activity.user.firstName[0]}${activity.user.lastName[0]}`}
                  </AvatarFallback>
                </Avatar>

                <div className="flex-1 space-y-1">
                  <p className="text-sm">
                    <span className="font-medium">
                      {activity.user.firstName} {activity.user.lastName}
                    </span>{" "}
                    {activity.action}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {formatDateToNowInTimezone(activity.createdAt)}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
};



