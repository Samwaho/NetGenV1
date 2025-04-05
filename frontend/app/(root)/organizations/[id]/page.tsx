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
    <div className="container max-w-7xl mx-auto px-2 sm:px-4 py-4 sm:py-8 space-y-4 sm:space-y-8">
      <OrganizationHeader 
        name={organization.name}
        ownerName={ownerName}
        createdAt={organization.createdAt}
        organizationId={organizationId}
      />
      <OrganizationStats 
        membersCount={organization.members.length} 
        rolesCount={organization.roles.length} 
        status={organization.status} 
      />
      <Tabs defaultValue="members" className="space-y-4">
        <TabsList className="w-auto ">
          <TabsTrigger value="members" className="text-xs sm:text-sm">Members</TabsTrigger>
          <TabsTrigger value="roles" className="text-xs sm:text-sm">Roles</TabsTrigger>
          <TabsTrigger value="subscriptions" className="text-xs sm:text-sm">Subscriptions</TabsTrigger>
          <TabsTrigger value="activity" className="text-xs sm:text-sm">Activity</TabsTrigger>
        </TabsList>
        <TabsContent value="members" className="mt-4">
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
        <TabsContent value="roles" className="mt-4">
          <RolesTab 
            roles={organization.roles} 
            organizationId={organizationId}
            organization={organization}
            currentUserId={currentUserId}
          />
        </TabsContent>
        <TabsContent value="subscriptions" className="mt-4">
          <SubscriptionsTab 
            organizationId={organizationId}
            organization={organization}
            currentUserId={currentUserId}
          />
        </TabsContent>
        <TabsContent value="activity" className="mt-4">
          <ActivityTab organizationId={organizationId} />
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default OrganizationPage;













