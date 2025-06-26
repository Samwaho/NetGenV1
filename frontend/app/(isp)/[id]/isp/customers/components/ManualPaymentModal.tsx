"use client";

import { useState } from "react";
import { useMutation } from "@apollo/client";
import { PROCESS_MANUAL_PAYMENT } from "@/graphql/isp_customers";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import { CreditCard, Loader2 } from "lucide-react";
import { ISPCustomer } from "@/types/isp_customer";

interface ManualPaymentModalProps {
  customer: ISPCustomer;
  onPaymentProcessed?: () => void;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}

export function ManualPaymentModal({ 
  customer, 
  onPaymentProcessed, 
  open = false, 
  onOpenChange 
}: ManualPaymentModalProps) {
  const [internalOpen, setInternalOpen] = useState(false);
  const [amount, setAmount] = useState("");
  const [transactionId, setTransactionId] = useState("");
  const [phoneNumber, setPhoneNumber] = useState(customer.phone || "");

  // Use controlled state if provided, otherwise use internal state
  const isOpen = onOpenChange ? open : internalOpen;
  const setIsOpen = onOpenChange || setInternalOpen;

  const [processPayment, { loading }] = useMutation(PROCESS_MANUAL_PAYMENT, {
    onCompleted: (data) => {
      if (data.processManualPayment.success) {
        toast.success(data.processManualPayment.message);
        setIsOpen(false);
        setAmount("");
        setTransactionId("");
        onPaymentProcessed?.();
      } else {
        toast.error(data.processManualPayment.message || "Failed to process payment");
      }
    },
    onError: (error) => {
      toast.error(error.message || "Failed to process payment");
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    const numAmount = parseFloat(amount);
    if (isNaN(numAmount) || numAmount <= 0) {
      toast.error("Please enter a valid amount greater than 0");
      return;
    }

    processPayment({
      variables: {
        customerId: customer.id,
        amount: numAmount,
        transactionId: transactionId || undefined,
        phoneNumber: phoneNumber || undefined,
      },
    });
  };

  const handleOpenChange = (newOpen: boolean) => {
    setIsOpen(newOpen);
    if (!newOpen) {
      setAmount("");
      setTransactionId("");
      setPhoneNumber(customer.phone || "");
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Process Manual Payment</DialogTitle>
          <DialogDescription>
            Process a manual payment for {customer.firstName} {customer.lastName} ({customer.username})
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="amount">Amount (KES)</Label>
            <Input
              id="amount"
              type="number"
              step="0.01"
              min="0.01"
              placeholder="Enter payment amount"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              required
            />
            {customer.package && (
              <p className="text-xs text-muted-foreground">
                Package: {customer.package.name}
              </p>
            )}
          </div>
          
          <div className="space-y-2">
            <Label htmlFor="transactionId">Transaction ID (Optional)</Label>
            <Input
              id="transactionId"
              type="text"
              placeholder="Enter transaction ID or leave blank for auto-generated"
              value={transactionId}
              onChange={(e) => setTransactionId(e.target.value)}
            />
            <p className="text-xs text-muted-foreground">
              Leave blank to auto-generate a transaction ID
            </p>
          </div>
          
          <div className="space-y-2">
            <Label htmlFor="phoneNumber">Phone Number (Optional)</Label>
            <Input
              id="phoneNumber"
              type="tel"
              placeholder="Enter phone number"
              value={phoneNumber}
              onChange={(e) => setPhoneNumber(e.target.value)}
            />
            <p className="text-xs text-muted-foreground">
              Used for SMS notifications. Defaults to customer's phone if left blank.
            </p>
          </div>
          
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => handleOpenChange(false)}
              disabled={loading}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={loading || !amount}>
              {loading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Processing...
                </>
              ) : (
                "Process Payment"
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
} 