'use client';

import React, { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { 
  getActivePaymentMethod, 
  getAvailablePaymentMethods, 
  getPaymentMethodDisplayInfo,
  getPaymentMethodStatus,
  PaymentMethod 
} from '@/lib/payment-utils';
import { Organization } from '@/types/organization';

interface PaymentMethodSelectorProps {
  organization: Organization;
  onPaymentMethodChange?: (method: PaymentMethod) => void;
  onConfigureMethod?: (method: PaymentMethod) => void;
}

export function PaymentMethodSelector({ 
  organization, 
  onPaymentMethodChange,
  onConfigureMethod 
}: PaymentMethodSelectorProps) {
  const [isLoading, setIsLoading] = useState(false);
  const activeMethod = getActivePaymentMethod(organization);
  const availableMethods = getAvailablePaymentMethods(organization);

  const handleMethodSelect = async (method: PaymentMethod) => {
    if (isLoading) return;
    
    setIsLoading(true);
    try {
      // Here you would call your GraphQL mutation to set the payment method
      // await setPaymentMethod({ organizationId: organization.id, paymentMethod: method });
      
      onPaymentMethodChange?.(method);
    } catch (error) {
      console.error('Failed to set payment method:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const getStatusBadge = (method: PaymentMethod) => {
    const status = getPaymentMethodStatus(organization, method);
    
    switch (status) {
      case 'active':
        return <Badge variant="default" className="bg-green-100 text-green-800">Active</Badge>;
      case 'configured':
        return <Badge variant="secondary">Configured</Badge>;
      case 'not-configured':
        return <Badge variant="outline" className="text-gray-500">Not Configured</Badge>;
      default:
        return null;
    }
  };

  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-lg font-semibold">Payment Method</h3>
        <p className="text-sm text-gray-600">
          Select the payment method your organization will use for transactions.
        </p>
      </div>

      {activeMethod && (
        <Card className="border-green-200 bg-green-50">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              {getPaymentMethodDisplayInfo(activeMethod.method).icon}
              Active: {activeMethod.displayName}
            </CardTitle>
            <CardDescription>
              {activeMethod.description}
            </CardDescription>
          </CardHeader>
        </Card>
      )}

      <div className="grid gap-4 md:grid-cols-2">
        {availableMethods.map((method) => {
          const displayInfo = getPaymentMethodDisplayInfo(method.method);
          const isActive = activeMethod?.method === method.method;
          
          return (
            <Card 
              key={method.method}
              className={`cursor-pointer transition-all hover:shadow-md ${
                isActive 
                  ? 'border-green-300 bg-green-50' 
                  : 'border-gray-200 hover:border-gray-300'
              }`}
              onClick={() => !isActive && handleMethodSelect(method.method)}
            >
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="text-2xl">{displayInfo.icon}</span>
                    <div>
                      <CardTitle className="text-base">{method.displayName}</CardTitle>
                      <CardDescription className="text-sm">
                        {method.description}
                      </CardDescription>
                    </div>
                  </div>
                  {getStatusBadge(method.method)}
                </div>
              </CardHeader>
              
              <CardContent>
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium">Status</span>
                    <div className="flex items-center gap-2">
                      <Switch 
                        checked={isActive}
                        disabled={!method.isConfigured || isLoading}
                        onCheckedChange={() => !isActive && handleMethodSelect(method.method)}
                      />
                      <span className="text-sm">
                        {isActive ? 'Active' : method.isConfigured ? 'Inactive' : 'Not Configured'}
                      </span>
                    </div>
                  </div>
                  
                  {!method.isConfigured && (
                    <Button 
                      variant="outline" 
                      size="sm"
                      onClick={(e) => {
                        e.stopPropagation();
                        onConfigureMethod?.(method.method);
                      }}
                      className="w-full"
                    >
                      Configure {method.displayName}
                    </Button>
                  )}
                  
                  {method.isConfigured && !isActive && (
                    <Button 
                      size="sm"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleMethodSelect(method.method);
                      }}
                      disabled={isLoading}
                      className="w-full"
                    >
                      {isLoading ? 'Activating...' : `Activate ${method.displayName}`}
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {!activeMethod && (
        <div className="text-center py-8 text-gray-500">
          <p>No payment method is currently active.</p>
          <p className="text-sm">Configure and activate a payment method to start accepting payments.</p>
        </div>
      )}
    </div>
  );
}
