import { useState } from 'react';
import { useQuery, useMutation } from '@apollo/client';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { toast } from 'sonner';
import { GET_PLANS } from '@/graphql/plan';
import { CREATE_SUBSCRIPTION } from '@/graphql/subscription';
import { addMonths } from 'date-fns';
import { Plan, PlansResponse } from '@/types/plan';
import { CheckIcon } from 'lucide-react';

interface NewSubscriptionModalProps {
  isOpen: boolean;
  onClose: () => void;
  organizationId: string;
}

export function NewSubscriptionModal({ isOpen, onClose, organizationId }: NewSubscriptionModalProps) {
  const [selectedPlan, setSelectedPlan] = useState<string | null>(null);
  const [billingCycle, setBillingCycle] = useState<'monthly' | 'yearly'>('monthly');

  const { data: plansData, loading: plansLoading } = useQuery<PlansResponse>(GET_PLANS);

  const [createSubscription, { loading: creating }] = useMutation(CREATE_SUBSCRIPTION, {
    onCompleted: (data) => {
      toast.success(data.createSubscription.message);
      onClose();
    },
    onError: (error) => {
      toast.error(error.message);
    },
    refetchQueries: ['GetSubscriptions'],
  });

  const handleSubscribe = async () => {
    if (!selectedPlan) return;

    const startDate = new Date();
    const endDate = billingCycle === 'monthly' 
      ? addMonths(startDate, 1)
      : addMonths(startDate, 12);

    await createSubscription({
      variables: {
        input: {
          organizationId,
          planId: selectedPlan,
          startDate: startDate.toISOString(),
          endDate: endDate.toISOString(),
          autoRenew: true,
        },
      },
    });
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[600px]">
        <DialogHeader>
          <DialogTitle>Choose a Plan</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="flex justify-center space-x-4">
            <Button
              variant={billingCycle === 'monthly' ? 'default' : 'outline'}
              onClick={() => setBillingCycle('monthly')}
            >
              Monthly
            </Button>
            <Button
              variant={billingCycle === 'yearly' ? 'default' : 'outline'}
              onClick={() => setBillingCycle('yearly')}
            >
              Yearly (Save 20%)
            </Button>
          </div>

          <div className="grid gap-4">
            {plansData?.plans?.plans.map((plan: Plan) => (
              <Card
                key={plan.id}
                className={`cursor-pointer ${
                  selectedPlan === plan.id ? 'border-primary' : ''
                }`}
                onClick={() => setSelectedPlan(plan.id)}
              >
                <CardContent className="p-4">
                  <div className="flex justify-between items-center">
                    <div>
                      <h3 className="font-semibold">{plan.name}</h3>
                      <p className="text-sm text-muted-foreground">
                        {plan.description}
                      </p>
                      <ul className="mt-2 space-y-1">
                        {plan.features.map((feature, index) => (
                          <li key={index} className="text-sm text-muted-foreground flex items-center">
                            <CheckIcon className="w-4 h-4 mr-2" />
                            {feature}
                          </li>
                        ))}
                      </ul>
                    </div>
                    <div className="text-right">
                      <p className="text-2xl font-bold">
                        ${billingCycle === 'yearly' 
                          ? (plan.price * 12 * 0.8).toFixed(2)
                          : plan.price.toFixed(2)}
                      </p>
                      <p className="text-sm text-muted-foreground">
                        per {billingCycle === 'yearly' ? 'year' : 'month'}
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>

          <div className="flex justify-end space-x-2">
            <Button variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button
              onClick={handleSubscribe}
              disabled={!selectedPlan || creating}
            >
              Subscribe
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
