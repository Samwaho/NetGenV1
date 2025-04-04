"use client";

import { useQuery } from "@apollo/client";
import { useParams } from "next/navigation";
import { GET_ORGANIZATION } from "@/graphql/organization";
import { CURRENT_USER } from "@/graphql/auth";
import { Organization } from "@/types/organization";
import { LoadingSkeleton } from "./components/LoadingSkeleton";
import { OrganizationHeader } from "./components/OrganizationHeader";
import { OrganizationStats } from "./components/OrganizationStats";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { MembersTab } from "./components/MembersTab";
import { RolesTab } from "./components/RolesTab";
import { SubscriptionsTab } from "./components/SubscriptionsTab";
import { ActivityTab } from "./components/ActivityTab";

const OrganizationPage = () => {
  const params = useParams();
  const organizationId = params?.id as string;
  
  const { data: userData, loading: userLoading } = useQuery(CURRENT_USER);
  const { loading, error, data } = useQuery<{ organization: Organization }>(GET_ORGANIZATION, {
    variables: { id: organizationId },
    skip: !organizationId,
  });

  if (!organizationId) return <div>Invalid organization ID</div>;
  if (loading || userLoading) return <LoadingSkeleton />;
  if (error) return <div>Error loading organization</div>;
  if (!data?.organization) return <div>Organization not found</div>;
  if (!userData?.currentUser) return <div>User not authenticated</div>;

  const organization = data.organization;
  const currentUserId = userData.currentUser.id;

  // Get the owner's name from the members array
  const owner = organization.members.find((member) => 
    member.user?.id === organization.owner.id
  );
  const ownerName = owner?.user ? 
    `${owner.user.firstName} ${owner.user.lastName}` : 
    'Unknown';

  return (
    <div className="container mx-auto py-6 space-y-6 max-w-7xl mt-10">
      <OrganizationHeader 
        name={organization.name}
        ownerName={ownerName}
        createdAt={organization.createdAt}
        organizationId={organizationId}
      />
      <OrganizationStats membersCount={organization.members.length} rolesCount={organization.roles.length} status={organization.status} />
      <Tabs defaultValue="members" className="space-y-4">
        <TabsList>
          <TabsTrigger value="members">Members</TabsTrigger>
          <TabsTrigger value="roles">Roles</TabsTrigger>
          <TabsTrigger value="subscriptions">Subscriptions</TabsTrigger>
          <TabsTrigger value="activity">Activity</TabsTrigger>
        </TabsList>
        <TabsContent value="members">
          <MembersTab 
            members={organization.members.map(member => ({
              ...member,
              status: member.status as "ACTIVE" | "PENDING" | "INACTIVE"
            }))} 
            organizationId={organizationId}
            organization={organization}
            currentUserId={currentUserId}
          />
        </TabsContent>
        <TabsContent value="roles">
          <RolesTab 
            roles={organization.roles} 
            organizationId={organizationId}
            organization={organization}
            currentUserId={currentUserId}
          />
        </TabsContent>
        <TabsContent value="subscriptions">
          <SubscriptionsTab 
            organizationId={organizationId}
            organization={organization}
            currentUserId={currentUserId}
          />
        </TabsContent>
        <TabsContent value="activity">
          <ActivityTab organizationId={organizationId} />
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default OrganizationPage;













