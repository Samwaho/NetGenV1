import { Card, CardContent } from "@/components/ui/card";

export const ActivityTab = () => {
  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h2 className="text-xl font-semibold">Recent Activity</h2>
      </div>

      <Card>
        <CardContent className="p-6">
          <p className="text-muted-foreground text-center py-8">
            Activity tracking coming soon
          </p>
        </CardContent>
      </Card>
    </div>
  );
};