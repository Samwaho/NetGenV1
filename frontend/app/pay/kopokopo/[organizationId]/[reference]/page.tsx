"use client";

import { useState, useEffect } from "react";
import { useParams } from "next/navigation";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Phone, CreditCard, CheckCircle, AlertCircle } from "lucide-react";

interface PaymentDetails {
  amount: number;
  description: string;
  reference: string;
  organization_name: string;
  expires_at: string;
}

export default function KopoKopoPaymentPage() {
  const params = useParams();
  const organizationId = params.organizationId as string;
  const reference = params.reference as string;
  
  const [phoneNumber, setPhoneNumber] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [paymentDetails, setPaymentDetails] = useState<PaymentDetails | null>(null);
  const [paymentStatus, setPaymentStatus] = useState<"pending" | "processing" | "success" | "failed">("pending");

  useEffect(() => {
    fetchPaymentDetails();
  }, []);

  const fetchPaymentDetails = async () => {
    try {
      const response = await fetch(`/api/payment-links/status/${reference}`);
      if (response.ok) {
        const data = await response.json();
        setPaymentDetails(data);
      } else {
        toast.error("Payment link not found or expired");
      }
    } catch (error) {
      toast.error("Failed to load payment details");
    }
  };

  const formatPhoneNumber = (phone: string) => {
    // Remove all non-digits
    const cleaned = phone.replace(/\D/g, "");
    
    // Format as Kenyan phone number
    if (cleaned.startsWith("254")) {
      return cleaned;
    } else if (cleaned.startsWith("0")) {
      return "254" + cleaned.substring(1);
    } else if (cleaned.startsWith("7") || cleaned.startsWith("1")) {
      return "254" + cleaned;
    }
    
    return cleaned;
  };

  const initiatePayment = async () => {
    if (!phoneNumber || phoneNumber.length < 10) {
      toast.error("Please enter a valid phone number");
      return;
    }

    if (!paymentDetails) {
      toast.error("Payment details not loaded");
      return;
    }

    setIsLoading(true);
    setPaymentStatus("processing");

    try {
      const formattedPhone = formatPhoneNumber(phoneNumber);
      
      const response = await fetch(`/api/payments/kopokopo/initiate-payment/${organizationId}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          phoneNumber: formattedPhone,
          amount: paymentDetails.amount,
          reference: reference,
          description: paymentDetails.description,
          metadata: {
            customer_reference: reference,
            payment_type: "customer_payment"
          }
        }),
      });

      if (!response.ok) {
        throw new Error("Failed to initiate payment");
      }

      const data = await response.json();
      
      if (data.success) {
        setPaymentStatus("success");
        toast.success("Payment initiated! Check your phone for the payment prompt.");
        
        // Start polling for payment status
        pollPaymentStatus();
      } else {
        setPaymentStatus("failed");
        toast.error(data.message || "Failed to initiate payment");
      }
    } catch (error) {
      setPaymentStatus("failed");
      toast.error("Failed to initiate payment");
    } finally {
      setIsLoading(false);
    }
  };

  const pollPaymentStatus = async () => {
    const maxAttempts = 30; // 5 minutes with 10-second intervals
    let attempts = 0;

    const poll = async () => {
      if (attempts >= maxAttempts) {
        toast.info("Payment status polling ended. Please check your payment status manually.");
        return;
      }

      try {
        const response = await fetch(`/api/payment-links/status/${reference}`);
        if (response.ok) {
          const data = await response.json();
          if (data.status === "completed") {
            setPaymentStatus("success");
            toast.success("Payment completed successfully!");
            return;
          }
        }
      } catch (error) {
        console.error("Error polling payment status:", error);
      }

      attempts++;
      setTimeout(poll, 10000); // Poll every 10 seconds
    };

    poll();
  };

  if (!paymentDetails) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <Card className="w-full max-w-md">
          <CardContent className="p-6">
            <div className="flex items-center justify-center">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
            </div>
            <p className="text-center mt-4 text-gray-600">Loading payment details...</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="mx-auto w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center mb-4">
            <CreditCard className="w-6 h-6 text-blue-600" />
          </div>
          <CardTitle>KopoKopo Payment</CardTitle>
          <CardDescription>
            Complete your payment using KopoKopo
          </CardDescription>
        </CardHeader>
        
        <CardContent className="space-y-6">
          {/* Payment Details */}
          <div className="bg-gray-50 p-4 rounded-lg space-y-2">
            <div className="flex justify-between">
              <span className="text-gray-600">Amount:</span>
              <span className="font-semibold">KES {paymentDetails.amount.toLocaleString()}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600">Description:</span>
              <span className="font-medium">{paymentDetails.description}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600">Reference:</span>
              <span className="font-mono text-sm">{paymentDetails.reference}</span>
            </div>
          </div>

          {/* Payment Status */}
          {paymentStatus === "success" && (
            <div className="bg-green-50 border border-green-200 p-4 rounded-lg">
              <div className="flex items-center gap-2">
                <CheckCircle className="w-5 h-5 text-green-600" />
                <span className="text-green-800 font-medium">Payment Successful!</span>
              </div>
              <p className="text-green-700 text-sm mt-1">
                Your payment has been processed successfully. You will receive a confirmation SMS shortly.
              </p>
            </div>
          )}

          {paymentStatus === "failed" && (
            <div className="bg-red-50 border border-red-200 p-4 rounded-lg">
              <div className="flex items-center gap-2">
                <AlertCircle className="w-5 h-5 text-red-600" />
                <span className="text-red-800 font-medium">Payment Failed</span>
              </div>
              <p className="text-red-700 text-sm mt-1">
                There was an error processing your payment. Please try again.
              </p>
            </div>
          )}

          {/* Phone Number Input */}
          {paymentStatus === "pending" && (
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="phone">Phone Number <span className="text-red-500">*</span></Label>
                <div className="relative">
                  <Phone className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                  <Input
                    id="phone"
                    type="tel"
                    placeholder="e.g., 0712345678"
                    value={phoneNumber}
                    onChange={(e) => setPhoneNumber(e.target.value)}
                    className="pl-10"
                  />
                </div>
                <p className="text-xs text-gray-500">
                  Enter the phone number registered with M-Pesa
                </p>
              </div>

              <Button 
                onClick={initiatePayment} 
                disabled={isLoading || !phoneNumber}
                className="w-full"
              >
                {isLoading ? "Initiating Payment..." : "Pay with KopoKopo"}
              </Button>
            </div>
          )}

          {/* Processing Status */}
          {paymentStatus === "processing" && (
            <div className="text-center space-y-4">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
              <p className="text-gray-600">Processing your payment...</p>
              <p className="text-sm text-gray-500">
                Please check your phone for the payment prompt and enter your PIN to complete the payment.
              </p>
            </div>
          )}

          {/* Instructions */}
          <div className="bg-blue-50 border border-blue-200 p-4 rounded-lg">
            <h4 className="font-medium text-blue-800 mb-2">Instructions:</h4>
            <ol className="text-sm text-blue-700 space-y-1">
              <li>1. Enter your M-Pesa registered phone number</li>
              <li>2. Click "Pay with KopoKopo"</li>
              <li>3. Check your phone for the payment prompt</li>
              <li>4. Enter your M-Pesa PIN to complete payment</li>
              <li>5. Wait for confirmation SMS</li>
            </ol>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
