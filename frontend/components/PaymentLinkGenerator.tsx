"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Copy, ExternalLink, QrCode } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { useQuery, useMutation } from "@apollo/client";
import { GET_ISP_CUSTOMER } from "@/graphql/isp_customers";
import { GENERATE_PAYMENT_LINK, GeneratePaymentLinkInput, GeneratePaymentLinkResponse } from "@/graphql/payment_links";

interface PaymentLinkGeneratorProps {
  organizationId: string;
  customerId: string;
  customerName: string;
  onLinkGenerated?: (link: string) => void;
  disableDialog?: boolean;
}

interface PaymentLinkResponse {
  payment_link: string;
  reference: string;
  ussd_code?: string;
  qr_code?: string;
  expires_at: string;
}

interface CustomerPackage {
  id: string;
  name: string;
  price: number;
  description?: string;
  duration: number;
  durationUnit: string;
  dataLimit?: number;
  dataLimitUnit?: string;
}

interface CustomerData {
  customer: {
    id: string;
    firstName: string;
    lastName: string;
    package?: CustomerPackage;
  };
}

export function PaymentLinkGenerator({ 
  organizationId, 
  customerId, 
  customerName,
  onLinkGenerated,
  disableDialog = false
}: PaymentLinkGeneratorProps) {
  const [amount, setAmount] = useState("");
  const [description, setDescription] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [generatedLink, setGeneratedLink] = useState<PaymentLinkResponse | null>(null);
  const [showDialog, setShowDialog] = useState(false);

  // Fetch customer package details using GraphQL
  const { data: customerData, loading: isLoadingPackage, error: packageError } = useQuery<CustomerData>(
    GET_ISP_CUSTOMER,
    {
      variables: { id: customerId },
      skip: !customerId,
      fetchPolicy: "cache-first",
    }
  );

  // GraphQL mutation for generating payment links
  const [generatePaymentLinkMutation, { loading: isGenerating }] = useMutation<GeneratePaymentLinkResponse>(
    GENERATE_PAYMENT_LINK
  );

  // Extract package data and set form values when data is loaded
  useEffect(() => {
    if (customerData?.customer?.package) {
      const packageData = customerData.customer.package;
      setAmount(packageData.price.toString());
      
      // Create a more robust description that handles missing duration data
      let durationText = '';
      if (packageData.duration && packageData.durationUnit) {
        durationText = ` - ${packageData.duration} ${packageData.durationUnit}`;
      } else if (packageData.duration) {
        durationText = ` - ${packageData.duration} days`;
      } else {
        durationText = '';
      }
      
      setDescription(`Payment for ${packageData.name}${durationText}`);
    }
  }, [customerData]);

  // Show error toast if package fetch fails
  useEffect(() => {
    if (packageError) {
      console.error("Error fetching customer package:", packageError);
      toast.error("Failed to load customer package details");
    }
  }, [packageError]);

  const generatePaymentLink = async () => {
    if (!amount || parseFloat(amount) <= 0) {
      toast.error("Please enter a valid amount");
      return;
    }

    setIsLoading(true);
    try {
      const input: GeneratePaymentLinkInput = {
        customerId: customerId,
        amount: parseFloat(amount),
        description: description || `Payment for ${customerName}`,
        expiryHours: 24
      };

      const { data } = await generatePaymentLinkMutation({
        variables: {
          organizationId: organizationId,
          input: input
        }
      });

      if (data?.generatePaymentLink.success && data.generatePaymentLink.paymentLink) {
        const paymentLinkData = data.generatePaymentLink.paymentLink;
        setGeneratedLink(paymentLinkData);
        setShowDialog(true);
        onLinkGenerated?.(paymentLinkData.payment_link);
        toast.success("Payment link generated successfully!");
      } else {
        throw new Error(data?.generatePaymentLink.message || "Failed to generate payment link");
      }
    } catch (error) {
      console.error("Error generating payment link:", error);
      toast.error("Failed to generate payment link");
    } finally {
      setIsLoading(false);
    }
  };

  const copyToClipboard = (text: string, type: string) => {
    navigator.clipboard.writeText(text);
    toast.success(`${type} copied to clipboard`);
  };

  const openPaymentLink = (link: string) => {
    window.open(link, "_blank");
  };

  const content = (
    <div className="space-y-4">
      <Card className="border-0 shadow-lg bg-gradient-to-br from-background to-muted/50">
        <CardHeader className="pb-4">
          <CardTitle className="text-xl font-bold bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent">
            Generate Payment Link
          </CardTitle>
          <CardDescription className="text-muted-foreground">
            Create a payment link for <span className="font-medium text-foreground">{customerName}</span> with a unique reference
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
                     {/* Package Information */}
           {isLoadingPackage ? (
             <div className="flex items-center justify-center py-6">
               <div className="flex items-center gap-2 text-sm text-muted-foreground">
                 <div className="h-4 w-4 animate-spin rounded-full border-2 border-primary border-t-transparent"></div>
                 Loading package details...
               </div>
             </div>
                       ) : customerData?.customer?.package ? (
              <div className="bg-gradient-to-r from-blue-50/50 to-indigo-50/50 dark:from-blue-950/50 dark:to-indigo-950/50 border border-blue-200/50 dark:border-blue-800/50 rounded-lg p-4 shadow-sm">
                <div className="flex items-center gap-2 mb-3">
                  <div className="h-2 w-2 bg-blue-500 rounded-full"></div>
                  <h4 className="font-semibold text-blue-900 dark:text-blue-100 text-sm">Customer Package</h4>
                </div>
                <div className="space-y-2">
                  <div className="flex justify-between items-center py-1">
                    <span className="text-sm font-medium text-muted-foreground">Package:</span>
                    <span className="text-sm font-semibold text-blue-900 dark:text-blue-100">{customerData.customer.package.name}</span>
                  </div>
                  <div className="flex justify-between items-center py-1">
                    <span className="text-sm font-medium text-muted-foreground">Price:</span>
                    <span className="text-sm font-bold text-green-600 dark:text-green-400">KES {customerData.customer.package.price.toLocaleString()}</span>
                  </div>
                                     <div className="flex justify-between items-center py-1">
                     <span className="text-sm font-medium text-muted-foreground">Duration:</span>
                     <span className="text-sm text-blue-900 dark:text-blue-100">
                       {customerData.customer.package.duration && customerData.customer.package.durationUnit 
                         ? `${customerData.customer.package.duration} ${customerData.customer.package.durationUnit}`
                         : customerData.customer.package.duration 
                         ? `${customerData.customer.package.duration} days`
                         : 'Not specified'
                       }
                     </span>
                   </div>
                  {customerData.customer.package.dataLimit && (
                    <div className="flex justify-between items-center py-1">
                      <span className="text-sm font-medium text-muted-foreground">Data Limit:</span>
                      <span className="text-sm text-blue-900 dark:text-blue-100">{customerData.customer.package.dataLimit} {customerData.customer.package.dataLimitUnit}</span>
                    </div>
                  )}
                  {customerData.customer.package.description && (
                    <div className="pt-2 border-t border-blue-200/50 dark:border-blue-800/50">
                      <div className="text-xs text-muted-foreground mb-1">Description:</div>
                      <div className="text-sm text-foreground bg-background/50 rounded px-2 py-1">{customerData.customer.package.description}</div>
                    </div>
                  )}
                </div>
              </div>
            ) : (
              <div className="bg-gradient-to-r from-amber-50/50 to-yellow-50/50 dark:from-amber-950/50 dark:to-yellow-950/50 border border-amber-200/50 dark:border-amber-800/50 rounded-lg p-4 shadow-sm">
                <div className="flex items-center gap-2 mb-2">
                  <div className="h-2 w-2 bg-amber-500 rounded-full"></div>
                  <h4 className="font-semibold text-amber-900 dark:text-amber-100 text-sm">No Package Assigned</h4>
                </div>
                <div className="text-sm text-amber-800 dark:text-amber-200">
                  This customer doesn't have a package assigned. Please enter payment details manually.
                </div>
              </div>
            )}

                     <div className="grid gap-4 md:grid-cols-2">
             <div className="space-y-2">
               <Label htmlFor="amount" className="text-sm font-medium text-muted-foreground">
                 Amount (KES) <span className="text-red-500">*</span>
               </Label>
               <Input
                 id="amount"
                 type="number"
                 placeholder="Enter amount"
                 value={amount}
                 onChange={(e) => setAmount(e.target.value)}
                 min="1"
                 step="0.01"
                 disabled={isLoadingPackage}
               />
             </div>
             <div className="space-y-2">
               <Label htmlFor="description" className="text-sm font-medium text-muted-foreground">
                 Description
               </Label>
               <Input
                 id="description"
                 placeholder="Payment description"
                 value={description}
                 onChange={(e) => setDescription(e.target.value)}
                 disabled={isLoadingPackage}
               />
             </div>
           </div>
          
                                 <Button 
              onClick={generatePaymentLink} 
              disabled={isLoading || isGenerating || !amount || isLoadingPackage}
              className="w-full bg-gradient-custom text-white hover:text-white font-medium py-2.5 rounded-lg transition-all duration-200 shadow-md hover:shadow-lg disabled:opacity-50 disabled:cursor-not-allowed"
            >
             {isLoading || isGenerating ? (
               <div className="flex items-center gap-2">
                 <div className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent"></div>
                 Generating...
               </div>
             ) : isLoadingPackage ? (
               <div className="flex items-center gap-2">
                 <div className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent"></div>
                 Loading...
               </div>
             ) : (
               "Generate Payment Link"
             )}
           </Button>
        </CardContent>
      </Card>

             {/* Payment Link Dialog */}
               {!disableDialog && (
          <Dialog open={showDialog} onOpenChange={setShowDialog}>
            <DialogContent className="max-w-lg border-0 shadow-2xl bg-gradient-to-br from-background to-muted/50">
              <DialogHeader className="pb-4">
                <DialogTitle className="text-xl font-bold bg-gradient-to-r from-green-600 to-emerald-600 bg-clip-text text-transparent">
                  Payment Link Generated
                </DialogTitle>
              </DialogHeader>
          
                                           {generatedLink && (
              <div className="space-y-6">
                <div className="space-y-3">
                  <Label className="text-sm font-medium text-muted-foreground">Payment Link</Label>
                  <div className="flex items-center gap-2">
                    <Input
                      value={generatedLink.payment_link}
                      readOnly
                      className="font-mono text-xs bg-muted"
                    />
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => copyToClipboard(generatedLink.payment_link, "Payment link")}
                    >
                      <Copy className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => openPaymentLink(generatedLink.payment_link)}
                    >
                      <ExternalLink className="h-4 w-4" />
                    </Button>
                  </div>
                </div>

                                                           {generatedLink.ussd_code && (
                  <div className="space-y-3">
                    <Label className="text-sm font-medium text-muted-foreground">USSD Code (M-Pesa)</Label>
                    <div className="flex items-center gap-2">
                      <Input
                        value={generatedLink.ussd_code}
                        readOnly
                        className="font-mono text-xs bg-muted"
                      />
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => copyToClipboard(generatedLink.ussd_code!, "USSD code")}
                      >
                        <Copy className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                )}

                                                           <div className="space-y-3">
                  <Label className="text-sm font-medium text-muted-foreground">Reference Number</Label>
                  <div className="flex items-center gap-2">
                    <Input
                      value={generatedLink.reference}
                      readOnly
                      className="font-mono text-xs bg-muted"
                    />
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => copyToClipboard(generatedLink.reference, "Reference")}
                    >
                      <Copy className="h-4 w-4" />
                    </Button>
                  </div>
                </div>

                                                           <div className="text-sm text-muted-foreground bg-muted rounded-lg p-3">
                  <p className="font-medium">Expires: {new Date(generatedLink.expires_at).toLocaleString()}</p>
                </div>

                <div className="bg-gradient-to-r from-blue-50/50 to-indigo-50/50 dark:from-blue-950/50 dark:to-indigo-950/50 border border-blue-200/50 dark:border-blue-800/50 p-4 rounded-lg">
                  <div className="flex items-center gap-2 mb-3">
                    <div className="h-2 w-2 bg-blue-500 rounded-full"></div>
                    <p className="text-sm font-semibold text-blue-900 dark:text-blue-100">Instructions</p>
                  </div>
                  <ul className="text-sm text-blue-800 dark:text-blue-200 space-y-2">
                    <li className="flex items-start gap-2">
                      <span className="text-blue-600 dark:text-blue-400 mt-1">•</span>
                      <span>Share the payment link with the customer</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="text-blue-600 dark:text-blue-400 mt-1">•</span>
                      <span>Customer clicks link and enters their phone number</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="text-blue-600 dark:text-blue-400 mt-1">•</span>
                      <span>Payment prompt appears on their phone</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="text-blue-600 dark:text-blue-400 mt-1">•</span>
                      <span>Payment is automatically matched to this customer</span>
                    </li>
                  </ul>
                </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    )}
    </div>
  );

  return content;
}
