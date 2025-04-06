import { useQuery, useMutation } from '@apollo/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { GET_SUBSCRIPTIONS, CANCEL_SUBSCRIPTION } from '@/graphql/subscription';
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
import { Loader2, AlertCircle, CreditCard, CalendarRange, RefreshCcw, LockIcon } from 'lucide-react';
import { hasOrganizationPermissions } from "@/lib/permission-utils";
import { OrganizationPermissions } from "@/lib/permissions";
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";

interface SubscriptionsTabProps {
  organizationId: string;
  organization: Organization;
  currentUserId: string;
}

const SubscriptionsLoadingSkeleton = () => {
  return (
    <div className="space-y-4 p-2 sm:p-4 bg-card rounded-2xl shadow-md dark:border">
      {/* Header Section */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 py-2 sm:py-4">
        <div className="flex-1">
          <Skeleton className="h-10 w-[250px]" /> {/* Search input skeleton */}
        </div>
        <div className="flex items-center space-x-2">
          <Skeleton className="h-10 w-[150px]" /> {/* New Subscription button skeleton */}
        </div>
      </div>

      {/* Subscriptions List */}
      <div className="grid gap-4">
        {[1, 2, 3].map((index) => (
          <Card key={index} className="hover:shadow-md transition-shadow">
            <CardContent className="p-6">
              <div className="flex flex-col sm:flex-row justify-between gap-4">
                <div className="space-y-4 flex-1">
                  <div className="flex items-center gap-2">
                    <Skeleton className="h-7 w-[200px]" /> {/* Plan name skeleton */}
                    <Skeleton className="h-6 w-[80px]" /> {/* Status badge skeleton */}
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="flex items-center text-sm">
                      <Skeleton className="h-4 w-4 mr-2" /> {/* Icon skeleton */}
                      <Skeleton className="h-4 w-[200px]" /> {/* Date range skeleton */}
                    </div>
                    <div className="flex items-center text-sm">
                      <Skeleton className="h-4 w-4 mr-2" /> {/* Icon skeleton */}
                      <Skeleton className="h-4 w-[100px]" /> {/* Auto-renew skeleton */}
                    </div>
                  </div>
                </div>
                <div className="flex justify-end">
                  <Skeleton className="h-8 w-[80px]" /> {/* Action button skeleton */}
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
};

export function SubscriptionsTab({ organizationId, organization, currentUserId }: SubscriptionsTabProps) {
  const [isNewSubscriptionModalOpen, setIsNewSubscriptionModalOpen] = useState(false);
  const [subscriptionToCancel, setSubscriptionToCancel] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  
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
    return <SubscriptionsLoadingSkeleton />;
  }

  if (error) {
    return (
      <div className="flex items-center justify-center h-64 text-destructive">
        <AlertCircle className="h-6 w-6 mr-2" />
        <p>Error loading subscriptions</p>
      </div>
    );
  }

  let orgSubscriptions = data?.subscriptions?.subscriptions.filter(
    (sub: Subscription) => sub.organization.id === organizationId
  ) || [];

  // Filter subscriptions based on search query
  if (searchQuery) {
    orgSubscriptions = orgSubscriptions.filter(sub => 
      sub.plan.name.toLowerCase().includes(searchQuery.toLowerCase())
    );
  }

  const getStatusBadgeVariant = (status: string): 'default' | 'destructive' | 'secondary' | 'outline' => {
    switch (status.toLowerCase()) {
      case 'active':
        return 'default';
      case 'cancelled':
        return 'destructive';
      case 'expired':
        return 'secondary';
      default:
        return 'outline';
    }
  };

  return (
    <div className="space-y-4 p-2 sm:p-4 bg-card rounded-2xl shadow-md dark:border">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 py-2 sm:py-4">
        <div className="flex-1">
          <Input
            placeholder="Search subscriptions..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="max-w-sm text-sm"
          />
        </div>
        <div className="flex items-center space-x-2">
          {canManageSubscriptions ? (
            <Button 
              onClick={() => setIsNewSubscriptionModalOpen(true)}
              className="bg-gradient-custom text-white"
            >
              <CreditCard className="mr-2 h-4 w-4" />
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
      </div>

      {orgSubscriptions.length === 0 ? (
        <Card>
          <CardContent className="p-8 text-center">
            <div className="flex flex-col items-center space-y-4">
              <CreditCard className="h-12 w-12 text-muted-foreground" />
              <div className="space-y-2">
                <h3 className="text-lg font-semibold">No subscriptions found</h3>
                <p className="text-sm text-muted-foreground">
                  {searchQuery ? 'No subscriptions match your search.' : 'Get started by creating your first subscription.'}
                </p>
              </div>
              {canManageSubscriptions && !searchQuery && (
                <Button 
                  variant="outline" 
                  onClick={() => setIsNewSubscriptionModalOpen(true)}
                  className="mt-2"
                >
                  <CreditCard className="mr-2 h-4 w-4" />
                  Create your first subscription
                </Button>
              )}
            </div>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4">
          {orgSubscriptions.map((subscription) => (
            <Card key={subscription.id} className="hover:shadow-md transition-shadow">
              <CardContent className="p-6">
                <div className="flex flex-col sm:flex-row justify-between gap-4">
                  <div className="space-y-4">
                    <div className="flex items-center gap-2">
                      <h3 className="font-semibold text-lg">
                        {subscription.plan.name}
                      </h3>
                      <Badge variant={getStatusBadgeVariant(subscription.status)}>
                        {subscription.status}
                      </Badge>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div className="flex items-center text-sm text-muted-foreground">
                        <CalendarRange className="h-4 w-4 mr-2" />
                        <span>
                          {format(new Date(subscription.startDate), 'PPP')} - {format(new Date(subscription.endDate), 'PPP')}
                        </span>
                      </div>
                      <div className="flex items-center text-sm text-muted-foreground">
                        <RefreshCcw className="h-4 w-4 mr-2" />
                        <span>Auto-renew: {subscription.autoRenew ? 'Yes' : 'No'}</span>
                      </div>
                    </div>
                  </div>
                  {subscription.status === 'ACTIVE' && canManageSubscriptions && (
                    <div className="flex justify-end">
                      <Button
                        variant="destructive"
                        onClick={() => setSubscriptionToCancel(subscription.id)}
                        disabled={cancelling}
                        size="sm"
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
                    </div>
                  )}
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


