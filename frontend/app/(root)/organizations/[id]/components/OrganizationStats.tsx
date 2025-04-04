import { Users, Shield } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

type OrganizationStatsProps = {
  membersCount: number;
  rolesCount: number;
  status: string;
};

export const OrganizationStats = ({ membersCount, rolesCount, status }: OrganizationStatsProps) => {
  return (
    <div className="grid md:grid-cols-3 gap-6 mb-8">
      <Card className="shadow-sm ">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-medium text-muted-foreground">
            Total Members
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center space-x-2">
            <Users className="h-5 w-5 text-primary" />
            <span className="text-2xl font-bold">{membersCount}</span>
          </div>
        </CardContent>
      </Card>
      <Card className="shadow-sm ">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-medium text-muted-foreground">
            Available Roles
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center space-x-2">
            <Shield className="h-5 w-5 text-primary" />
            <span className="text-2xl font-bold">{rolesCount}</span>
          </div>
        </CardContent>
      </Card>
      <Card className="shadow-sm ">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-medium text-muted-foreground">
            Organization Status
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Badge variant="outline" className="bg-gradient-custom text-white">
            {status}
          </Badge>
        </CardContent>
      </Card>
    </div>
  );
};