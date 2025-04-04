import { useQuery, useMutation } from '@apollo/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { 
  GET_SUBSCRIPTIONS, 
  CANCEL_SUBSCRIPTION 
} from '@/graphql/subscription';
import { format } from 'date-fns';
import { useState } from 'react';
import { NewSubscriptionModal } from './NewSubscriptionModal';
import { Subscription, SubscriptionsResponse } from '@/types/subscription';
import { Organization } from '@/types/organization';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Loader2, AlertCircle } from 'lucide-react';
import { hasOrganizationPermissions } from "@/lib/permission-utils";
import { OrganizationPermissions } from "@/lib/permissions";
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { LockIcon } from 'lucide-react';

interface SubscriptionsTabProps {
  organizationId: string;
  organization: Organization;
  currentUserId: string;
}

export function SubscriptionsTab({ 
  organizationId, 
  organization, 
  currentUserId 
}: SubscriptionsTabProps) {
  const [isNewSubscriptionModalOpen, setIsNewSubscriptionModalOpen] = useState(false);
  const [subscriptionToCancel, setSubscriptionToCancel] = useState<string | null>(null);
  
  const canManageSubscriptions = hasOrganizationPermissions(
    organization,
    currentUserId,
    OrganizationPermissions.MANAGE_SUBSCRIPTIONS
  );

  const { data, loading, error } = useQuery<SubscriptionsResponse>(GET_SUBSCRIPTIONS);
  
  const [cancelSubscription, { loading: cancelling }] = useMutation(CANCEL_SUBSCRIPTION, {
    onCompleted: (data) => {
      toast.success(data.cancelSubscription.message);
      setSubscriptionToCancel(null);
    },
    onError: (error) => {
      toast.error(error.message);
      setSubscriptionToCancel(null);
    },
    refetchQueries: ['GetSubscriptions'],
  });

  const handleCancel = async () => {
    if (!subscriptionToCancel) return;
    
    await cancelSubscription({
      variables: { id: subscriptionToCancel },
    });
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center h-64 text-destructive">
        <AlertCircle className="h-6 w-6 mr-2" />
        <p>Error loading subscriptions</p>
      </div>
    );
  }

  const orgSubscriptions = data?.subscriptions?.subscriptions.filter(
    (sub: Subscription) => sub.organization.id === organizationId
  ) || [];

  const getStatusBadgeVariant = (status: string): 'default' | 'destructive' | 'secondary' | 'outline' => {
    switch (status.toLowerCase()) {
      case 'active':
        return 'default';
      case 'cancelled':
        return 'destructive';
      case 'expired':
        return 'secondary';
      default:
        return 'default';
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold">Subscriptions</h2>
        {canManageSubscriptions ? (
          <Button 
            onClick={() => setIsNewSubscriptionModalOpen(true)}
            className="bg-gradient-custom text-white"
          >
            New Subscription
          </Button>
        ) : (
          <Tooltip>
            <TooltipTrigger asChild>
              <Button variant="outline" disabled>
                <LockIcon className="mr-2 h-4 w-4" />
                New Subscription
              </Button>
            </TooltipTrigger>
            <TooltipContent>
              <p>You need subscription management permissions to create subscriptions</p>
            </TooltipContent>
          </Tooltip>
        )}
      </div>

      {orgSubscriptions.length === 0 ? (
        <Card>
          <CardContent className="p-6 text-center text-muted-foreground">
            <div className="py-8 space-y-3">
              <p>No subscriptions found.</p>
              <Button 
                variant="outline" 
                onClick={() => setIsNewSubscriptionModalOpen(true)}
              >
                Create your first subscription
              </Button>
            </div>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {orgSubscriptions.map((subscription) => (
            <Card key={subscription.id} className="hover:shadow-md transition-shadow">
              <CardContent className="p-6">
                <div className="flex justify-between items-start">
                  <div>
                    <div className="flex items-center gap-2 mb-2">
                      <h3 className="font-semibold text-lg">
                        {subscription.plan.name}
                      </h3>
                      <Badge variant={getStatusBadgeVariant(subscription.status)}>
                        {subscription.status}
                      </Badge>
                    </div>
                    <div className="space-y-2">
                      <p className="text-sm text-muted-foreground">
                        Period: {format(new Date(subscription.startDate), 'PPP')} - {format(new Date(subscription.endDate), 'PPP')}
                      </p>
                      <p className="text-sm text-muted-foreground">
                        Auto-renew: {subscription.autoRenew ? 'Yes' : 'No'}
                      </p>
                    </div>
                  </div>
                  <div className="space-x-2">
                    {subscription.status === 'ACTIVE' && canManageSubscriptions && (
                      <Button
                        variant="destructive"
                        onClick={() => setSubscriptionToCancel(subscription.id)}
                        disabled={cancelling}
                      >
                        {cancelling ? (
                          <>
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                            Cancelling...
                          </>
                        ) : (
                          'Cancel'
                        )}
                      </Button>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <NewSubscriptionModal
        isOpen={isNewSubscriptionModalOpen}
        onClose={() => setIsNewSubscriptionModalOpen(false)}
        organizationId={organizationId}
      />

      <AlertDialog open={!!subscriptionToCancel} onOpenChange={() => setSubscriptionToCancel(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Cancel Subscription</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to cancel this subscription? This action cannot be undone.
              Your access will continue until the end of the current billing period.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Keep Subscription</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleCancel}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {cancelling ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Cancelling...
                </>
              ) : (
                'Yes, Cancel Subscription'
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}







