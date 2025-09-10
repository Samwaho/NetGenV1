"use client";

import { useState } from "react";
import { useMutation } from "@apollo/client";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useForm, SubmitHandler } from "react-hook-form";
import { Organization } from "@/types/organization";
import { UPDATE_MPESA_CONFIGURATION } from "@/graphql/organization";
import { Separator } from "@/components/ui/separator";
import { hasOrganizationPermissions } from "@/lib/permission-utils";
import { OrganizationPermissions } from "@/lib/permissions";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { InfoIcon, AlertCircle } from "lucide-react";
import { isPaymentMethodActive, PaymentMethod } from "@/lib/payment-utils";

interface MpesaTabProps {
  organization: Organization;
  organizationId: string;
  currentUserId: string;
}

interface MpesaFormInputs {
  shortCode: string;
  businessName: string;
  accountReference: string;
  consumerKey: string;
  consumerSecret: string;
  passKey: string;
  environment: string;
  transactionType: string;
  stkPushShortCode: string;
  stkPushPassKey: string;
  isActive: boolean;
}

export const MpesaTab = ({ organization, organizationId, currentUserId }: MpesaTabProps) => {
  const [saving, setSaving] = useState(false);
  const [showSensitive, setShowSensitive] = useState(false);
  
  const canManageMpesa = hasOrganizationPermissions(
    organization,
    currentUserId,
    OrganizationPermissions.MANAGE_MPESA_CONFIG
  );
  
  const mpesaConfig = organization.mpesaConfig || {
    shortCode: "",
    businessName: "",
    accountReference: "",
    consumerKey: "",
    consumerSecret: "",
    passKey: "",
    environment: "sandbox",
    transactionType: "CustomerPayBillOnline",
    stkPushShortCode: "",
    stkPushPassKey: "",
    isActive: false,
    callbackUrl: "",
    stkPushCallbackUrl: "",
    c2bCallbackUrl: "",
    b2cResultUrl: "",
    b2cTimeoutUrl: "",
    createdAt: "",
    updatedAt: ""
  };

  const { register, handleSubmit, setValue, watch, formState: { errors } } = useForm<MpesaFormInputs>({
    defaultValues: {
      shortCode: mpesaConfig.shortCode || "",
      businessName: mpesaConfig.businessName || "",
      accountReference: mpesaConfig.accountReference || "",
      consumerKey: mpesaConfig.consumerKey || "",
      consumerSecret: mpesaConfig.consumerSecret || "",
      passKey: mpesaConfig.passKey || "",
      environment: mpesaConfig.environment || "sandbox",
      transactionType: mpesaConfig.transactionType || "CustomerPayBillOnline",
      stkPushShortCode: mpesaConfig.stkPushShortCode || "",
      stkPushPassKey: mpesaConfig.stkPushPassKey || "",
      isActive: mpesaConfig.isActive || false
    }
  });

  const [updateMpesaConfig] = useMutation(UPDATE_MPESA_CONFIGURATION, {
    onCompleted: () => {
      setSaving(false);
      toast.success("Mpesa configuration has been updated.");
    },
    onError: (error) => {
      setSaving(false);
      toast.error(error.message || "Failed to update Mpesa configuration");
    }
  });

  const onSubmit: SubmitHandler<MpesaFormInputs> = async (data) => {
    if (!canManageMpesa) {
      toast.error("You don't have permission to manage Mpesa configuration");
      return;
    }

    setSaving(true);
    try {
      await updateMpesaConfig({
        variables: {
          organizationId,
          input: {
            shortCode: data.shortCode,
            businessName: data.businessName,
            accountReference: data.accountReference || undefined,
            consumerKey: data.consumerKey || undefined,
            consumerSecret: data.consumerSecret || undefined,
            passKey: data.passKey || undefined,
            environment: data.environment,
            transactionType: data.transactionType,
            stkPushShortCode: data.stkPushShortCode || undefined,
            stkPushPassKey: data.stkPushPassKey || undefined,
            isActive: data.isActive
          }
        }
      });
    } catch (error) {
      console.error("Error updating Mpesa configuration:", error);
    }
  };

  const isMpesaActive = isPaymentMethodActive(organization, 'MPESA' as PaymentMethod);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Mpesa Integration</h2>
          <p className="text-muted-foreground">
            Configure Mpesa payment integration for your organization
          </p>
        </div>
      </div>

      {isMpesaActive && (
        <div className="bg-green-50 border border-green-200 p-4 rounded-md">
          <div className="flex gap-2">
            <InfoIcon className="h-5 w-5 text-green-500" />
            <div>
              <h3 className="font-medium text-green-800">Mpesa is Active</h3>
              <p className="text-green-700 text-sm">
                Mpesa is currently the active payment method for this organization.
              </p>
            </div>
          </div>
        </div>
      )}

      <div className="bg-blue-50 border border-blue-200 p-4 rounded-md">
        <div className="flex gap-2">
          <InfoIcon className="h-5 w-5 text-blue-500" />
          <div>
            <h3 className="font-medium text-blue-800">Information</h3>
            <p className="text-blue-700 text-sm">
              Callback URLs will be automatically generated for you when you save the configuration.
            </p>
          </div>
        </div>
      </div>

      <div className="bg-amber-50 border border-amber-200 p-4 rounded-md">
        <div className="flex gap-2">
          <AlertCircle className="h-5 w-5 text-amber-500" />
          <div>
            <h3 className="font-medium text-amber-800">Payment Method Management</h3>
            <p className="text-amber-700 text-sm">
              To activate Mpesa as your payment method, use the Payment Method selector in the main organization settings. 
              This configuration only sets up the Mpesa integration details.
            </p>
          </div>
        </div>
      </div>

      <Tabs defaultValue="settings" className="space-y-4">
        <TabsList>
          <TabsTrigger value="settings">Settings</TabsTrigger>
          <TabsTrigger value="callbacks">Callback URLs</TabsTrigger>
        </TabsList>
        
        <TabsContent value="settings">
          <form onSubmit={handleSubmit(onSubmit)}>
            <Card>
              <CardHeader>
                <CardTitle>Mpesa Configuration</CardTitle>
                <CardDescription>
                  Enter your Mpesa API credentials and configuration details
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="shortCode">Paybill/Till Number <span className="text-red-500">*</span></Label>
                    <Input
                      id="shortCode"
                      placeholder="e.g. 174379"
                      {...register("shortCode", { required: "Paybill/Till Number is required" })}
                      disabled={!canManageMpesa}
                    />
                    {errors.shortCode && (
                      <p className="text-sm text-red-500">{errors.shortCode.message}</p>
                    )}
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="businessName">Business Name <span className="text-red-500">*</span></Label>
                    <Input
                      id="businessName"
                      placeholder="Your business name"
                      {...register("businessName", { required: "Business name is required" })}
                      disabled={!canManageMpesa}
                    />
                    {errors.businessName && (
                      <p className="text-sm text-red-500">{errors.businessName.message}</p>
                    )}
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="accountReference">Account Reference</Label>
                    <Input
                      id="accountReference"
                      placeholder="Account Reference"
                      {...register("accountReference")}
                      disabled={!canManageMpesa}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="environment">Environment</Label>
                    <Select
                      defaultValue={mpesaConfig.environment || "sandbox"}
                      onValueChange={(value) => setValue("environment", value)}
                      disabled={!canManageMpesa}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select environment" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="sandbox">Sandbox</SelectItem>
                        <SelectItem value="production">Production</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <Separator />
                <h3 className="font-medium text-lg">API Credentials</h3>

                <div className="flex items-center justify-between mb-4">
                  <Label htmlFor="showSensitive" className="flex flex-col space-y-1">
                    <span>Show Sensitive Information</span>
                    <span className="font-normal text-xs text-muted-foreground">
                      Toggle to view or hide sensitive API credentials
                    </span>
                  </Label>
                  <Switch
                    id="showSensitive"
                    checked={showSensitive}
                    onCheckedChange={setShowSensitive}
                  />
                </div>

                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="consumerKey">Consumer Key</Label>
                    <Input
                      id="consumerKey"
                      placeholder="Daraja API Consumer Key"
                      type={showSensitive ? "text" : "password"}
                      {...register("consumerKey")}
                      disabled={!canManageMpesa}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="consumerSecret">Consumer Secret</Label>
                    <Input
                      id="consumerSecret"
                      placeholder="Daraja API Consumer Secret"
                      type={showSensitive ? "text" : "password"}
                      {...register("consumerSecret")}
                      disabled={!canManageMpesa}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="passKey">Pass Key</Label>
                    <Input
                      id="passKey"
                      placeholder="Pass Key for STK Push"
                      type={showSensitive ? "text" : "password"}
                      {...register("passKey")}
                      disabled={!canManageMpesa}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="transactionType">Transaction Type</Label>
                    <Select
                      defaultValue={mpesaConfig.transactionType || "CustomerPayBillOnline"}
                      onValueChange={(value) => setValue("transactionType", value)}
                      disabled={!canManageMpesa}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select transaction type" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="CustomerPayBillOnline">CustomerPayBillOnline</SelectItem>
                        <SelectItem value="CustomerBuyGoodsOnline">CustomerBuyGoodsOnline</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <Separator />
                <h3 className="font-medium text-lg">STK Push Configuration (Optional)</h3>
                <p className="text-sm text-muted-foreground">
                  Configure these if your STK Push details are different from your main credentials
                </p>

                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="stkPushShortCode">STK Push Short Code</Label>
                    <Input
                      id="stkPushShortCode"
                      placeholder="Leave empty to use main Short Code"
                      {...register("stkPushShortCode")}
                      disabled={!canManageMpesa}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="stkPushPassKey">STK Push Pass Key</Label>
                    <Input
                      id="stkPushPassKey"
                      placeholder="Leave empty to use main Pass Key"
                      type={showSensitive ? "text" : "password"}
                      {...register("stkPushPassKey")}
                      disabled={!canManageMpesa}
                    />
                  </div>
                </div>
              </CardContent>
              <CardFooter className="flex justify-between">
                <Button variant="outline" type="reset" disabled={!canManageMpesa || saving}>
                  Cancel
                </Button>
                <Button type="submit" disabled={!canManageMpesa || saving}>
                  {saving ? "Saving..." : "Save Changes"}
                </Button>
              </CardFooter>
            </Card>
          </form>
        </TabsContent>

        <TabsContent value="callbacks">
          <Card>
            <CardHeader>
              <CardTitle>Callback URLs</CardTitle>
              <CardDescription>
                These callback URLs are automatically generated. You will need to register them in your Safaricom Developer Portal.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {!mpesaConfig.callbackUrl ? (
                <div className="p-4 text-center">
                  <p className="text-muted-foreground">
                    Save your Mpesa configuration first to generate callback URLs
                  </p>
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label>General Callback URL</Label>
                    <div className="flex items-center gap-2">
                      <Input
                        value={mpesaConfig.callbackUrl}
                        readOnly
                        className="font-mono text-xs"
                      />
                      <Button 
                        variant="outline" 
                        onClick={() => {
                          navigator.clipboard.writeText(mpesaConfig.callbackUrl || "");
                          toast.success("URL copied to clipboard");
                        }}
                      >
                        Copy
                      </Button>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label>STK Push Callback URL</Label>
                    <div className="flex items-center gap-2">
                      <Input
                        value={mpesaConfig.stkPushCallbackUrl}
                        readOnly
                        className="font-mono text-xs"
                      />
                      <Button 
                        variant="outline" 
                        onClick={() => {
                          navigator.clipboard.writeText(mpesaConfig.stkPushCallbackUrl || "");
                          toast.success("URL copied to clipboard");
                        }}
                      >
                        Copy
                      </Button>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label>C2B Callback URL</Label>
                    <div className="flex items-center gap-2">
                      <Input
                        value={mpesaConfig.c2bCallbackUrl}
                        readOnly
                        className="font-mono text-xs"
                      />
                      <Button 
                        variant="outline" 
                        onClick={() => {
                          navigator.clipboard.writeText(mpesaConfig.c2bCallbackUrl || "");
                          toast.success("URL copied to clipboard");
                        }}
                      >
                        Copy
                      </Button>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label>B2C Result URL</Label>
                    <div className="flex items-center gap-2">
                      <Input
                        value={mpesaConfig.b2cResultUrl}
                        readOnly
                        className="font-mono text-xs"
                      />
                      <Button 
                        variant="outline" 
                        onClick={() => {
                          navigator.clipboard.writeText(mpesaConfig.b2cResultUrl || "");
                          toast.success("URL copied to clipboard");
                        }}
                      >
                        Copy
                      </Button>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label>B2C Timeout URL</Label>
                    <div className="flex items-center gap-2">
                      <Input
                        value={mpesaConfig.b2cTimeoutUrl}
                        readOnly
                        className="font-mono text-xs"
                      />
                      <Button 
                        variant="outline" 
                        onClick={() => {
                          navigator.clipboard.writeText(mpesaConfig.b2cTimeoutUrl || "");
                          toast.success("URL copied to clipboard");
                        }}
                      >
                        Copy
                      </Button>
                    </div>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}; 