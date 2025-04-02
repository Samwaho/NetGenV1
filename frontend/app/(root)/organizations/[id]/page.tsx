"use client";

import { useState } from "react";
import { useQuery } from "@apollo/client";
import { useParams } from "next/navigation";
import { GET_ORGANIZATION } from "@/graphql/organization";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";
import { OrganizationHeader } from "./components/OrganizationHeader";
import { OrganizationStats } from "./components/OrganizationStats";
import { MembersTab } from "./components/MembersTab";
import { RolesTab } from "./components/RolesTab";
import { ActivityTab } from "./components/ActivityTab";
import InviteMemberModal from "./InviteMemberModal";
import { LoadingSkeleton } from "./components/LoadingSkeleton";

const OrganizationPage = () => {
  const params = useParams();
  const { loading, error, data } = useQuery(GET_ORGANIZATION, {
    variables: { id: params.id },
  });
  const [isInviteModalOpen, setIsInviteModalOpen] = useState(false);

  if (loading) return <LoadingSkeleton />;
  if (error) return <div>Error loading organization</div>;

  const organization = data.organization;
  const ownerName = `${organization.owner.firstName} ${organization.owner.lastName}`;

  return (
    <div className="container mx-auto px-4 py-8 max-w-7xl mt-16">
      <OrganizationHeader 
        name={organization.name}
        ownerName={ownerName}
        createdAt={organization.createdAt}
      />

      <OrganizationStats 
        membersCount={organization.members.length}
        rolesCount={organization.roles.length}
        status={organization.status}
      />

      <Tabs defaultValue="members" className="space-y-6">
        <TabsList>
          <TabsTrigger value="members">Members</TabsTrigger>
          <TabsTrigger value="roles">Roles</TabsTrigger>
          <TabsTrigger value="activity">Activity</TabsTrigger>
        </TabsList>

        <TabsContent value="members">
          <MembersTab 
            members={organization.members}
            onInvite={() => setIsInviteModalOpen(true)}
          />
        </TabsContent>

        <TabsContent value="roles">
          <RolesTab 
            roles={organization.roles}
            organizationId={params.id as string}
          />
        </TabsContent>

        <TabsContent value="activity">
          <ActivityTab />
        </TabsContent>
      </Tabs>

      {data?.organization && (
        <InviteMemberModal
          isOpen={isInviteModalOpen}
          onClose={() => setIsInviteModalOpen(false)}
          organizationId={params.id as string}
          roles={data.organization.roles}
        />
      )}
    </div>
  );
};

export default OrganizationPage;

