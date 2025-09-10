"use client";

import { useState } from "react";
import { useMutation } from "@apollo/client";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useForm, SubmitHandler } from "react-hook-form";
import { Separator } from "@/components/ui/separator";
import { InfoIcon, ArrowLeft } from "lucide-react";
import { Organization, MpesaConfig, KopoKopoConfig } from "@/types/organization";
import { 
  getActivePaymentMethod, 
  getAvailablePaymentMethods, 
  getPaymentMethodDisplayInfo,
  getPaymentMethodStatus,
  PaymentMethod 
} from '@/lib/payment-utils';
import { 
  UPDATE_MPESA_CONFIGURATION, 
  UPDATE_KOPOKOPO_CONFIGURATION,
  SET_PAYMENT_METHOD 
} from "@/graphql/organization";
import { hasOrganizationPermissions } from "@/lib/permission-utils";
import { OrganizationPermissions } from "@/lib/permissions";

interface PaymentMethodsTabProps {
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

interface KopoKopoFormInputs {
  clientId: string;
  clientSecret: string;
  environment: string;
  businessName: string;
  tillNumber: string;
  webhookSecret: string;
  isActive: boolean;
}


export const PaymentMethodsTab = ({ organization, organizationId, currentUserId }: PaymentMethodsTabProps) => {
  const [selectedMethod, setSelectedMethod] = useState<PaymentMethod | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [showSensitive, setShowSensitive] = useState(false);
  
  const activeMethod = getActivePaymentMethod(organization);
  const availableMethods = getAvailablePaymentMethods(organization);

  const canManageMpesa = hasOrganizationPermissions(
    organization,
    currentUserId,
    OrganizationPermissions.MANAGE_MPESA_CONFIG
  );

  const canManageKopoKopo = hasOrganizationPermissions(
    organization,
    currentUserId,
    OrganizationPermissions.MANAGE_KOPOKOPO_CONFIG
  );

  // M-Pesa configuration
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

  // KopoKopo configuration
  const kopokopoConfig = organization.kopokopoConfig || {
    clientId: "",
    clientSecret: "",
    environment: "sandbox",
    businessName: "",
    tillNumber: "",
    webhookSecret: "",
    isActive: false,
    baseUrl: "",
    createdAt: "",
    updatedAt: ""
  };

  // M-Pesa form
  const mpesaForm = useForm<MpesaFormInputs>({
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

  // KopoKopo form
  const kopokopoForm = useForm<KopoKopoFormInputs>({
    defaultValues: {
      clientId: kopokopoConfig.clientId || "",
      clientSecret: kopokopoConfig.clientSecret || "",
      environment: kopokopoConfig.environment || "sandbox",
      businessName: kopokopoConfig.businessName || "",
      tillNumber: kopokopoConfig.tillNumber || "",
      webhookSecret: kopokopoConfig.webhookSecret || "",
      isActive: kopokopoConfig.isActive || false
    }
  });

  // Mutations
  const [updateMpesaConfig] = useMutation(UPDATE_MPESA_CONFIGURATION, {
    onCompleted: () => {
      setIsLoading(false);
      toast.success("M-Pesa configuration has been updated.");
    },
    onError: (error) => {
      setIsLoading(false);
      toast.error(error.message || "Failed to update M-Pesa configuration");
    }
  });

  const [updateKopoKopoConfig] = useMutation(UPDATE_KOPOKOPO_CONFIGURATION, {
    onCompleted: (data) => {
      setIsLoading(false);
      // Check if the response message indicates webhook registration
      const message = data?.updateKopokopoConfiguration?.message || "KopoKopo configuration has been updated.";
      toast.success(message);
    },
    onError: (error) => {
      setIsLoading(false);
      toast.error(error.message || "Failed to update KopoKopo configuration");
    }
  });

  const [setPaymentMethod] = useMutation(SET_PAYMENT_METHOD, {
    onCompleted: () => {
      setIsLoading(false);
      toast.success("Payment method updated successfully.");
    },
    onError: (error) => {
      setIsLoading(false);
      toast.error(error.message || "Failed to update payment method");
    }
  });

  const handleMethodSelect = async (method: PaymentMethod) => {
    if (isLoading) return;
    
    setIsLoading(true);
    try {
      await setPaymentMethod({
        variables: {
          organizationId,
          input: { paymentMethod: method }
        }
      });
    } catch (error) {
      console.error('Failed to set payment method:', error);
    }
  };

  const handleMpesaSubmit: SubmitHandler<MpesaFormInputs> = async (data) => {
    if (!canManageMpesa) {
      toast.error("You don't have permission to manage M-Pesa configuration");
      return;
    }

    setIsLoading(true);
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
      console.error("Error updating M-Pesa configuration:", error);
    }
  };

  const handleKopoKopoSubmit: SubmitHandler<KopoKopoFormInputs> = async (data) => {
    if (!canManageKopoKopo) {
      toast.error("You don't have permission to manage KopoKopo configuration");
      return;
    }

    setIsLoading(true);
    try {
      await updateKopoKopoConfig({
        variables: {
          organizationId,
          input: {
            clientId: data.clientId,
            clientSecret: data.clientSecret,
            environment: data.environment,
            businessName: data.businessName || undefined,
            tillNumber: data.tillNumber || undefined,
            webhookSecret: data.webhookSecret || undefined,
            isActive: data.isActive
          }
        }
      });
    } catch (error) {
      console.error("Error updating KopoKopo configuration:", error);
    }
  };

  const getStatusBadge = (method: PaymentMethod) => {
    const status = getPaymentMethodStatus(organization, method);
    
    switch (status) {
      case 'active':
        return <Badge variant="default">Active</Badge>;
      case 'configured':
        return <Badge variant="secondary">Configured</Badge>;
      case 'not-configured':
        return <Badge variant="outline">Not Configured</Badge>;
      default:
        return null;
    }
  };

  // If a specific method is selected, show its configuration
  if (selectedMethod) {
    const displayInfo = getPaymentMethodDisplayInfo(selectedMethod);
    const isActive = activeMethod?.method === selectedMethod;

    return (
      <div className="space-y-6">
        <div className="flex items-center gap-4">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setSelectedMethod(null)}
            className="flex items-center gap-2"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to Payment Methods
          </Button>
        </div>

        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-bold tracking-tight flex items-center gap-2">
              {displayInfo.icon}
              {displayInfo.name} Configuration
            </h2>
            <p className="text-muted-foreground">
              Configure {displayInfo.name} payment integration for your organization
            </p>
          </div>
          {getStatusBadge(selectedMethod)}
        </div>

        {isActive && (
          <div className="bg-blue-50 border border-blue-200 p-4 rounded-md">
            <div className="flex gap-2">
              <InfoIcon className="h-5 w-5 text-blue-500" />
              <div>
                <h3 className="font-medium text-blue-800">{displayInfo.name} is Active</h3>
                <p className="text-blue-700 text-sm">
                  {displayInfo.name} is currently the active payment method for this organization.
                </p>
              </div>
            </div>
          </div>
        )}

        {selectedMethod === 'MPESA' && (
          <MpesaConfigurationForm
            form={mpesaForm}
            onSubmit={handleMpesaSubmit}
            showSensitive={showSensitive}
            setShowSensitive={setShowSensitive}
            isLoading={isLoading}
            canManage={canManageMpesa}
            mpesaConfig={mpesaConfig}
          />
        )}

        {selectedMethod === 'KOPOKOPO' && (
          <KopoKopoConfigurationForm
            form={kopokopoForm}
            onSubmit={handleKopoKopoSubmit}
            showSensitive={showSensitive}
            setShowSensitive={setShowSensitive}
            isLoading={isLoading}
            canManage={canManageKopoKopo}
            kopokopoConfig={kopokopoConfig}
          />
        )}
      </div>
    );
  }

  // Show payment method selector
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold tracking-tight">Payment Methods</h2>
        <p className="text-muted-foreground">
          Select and configure the payment method your organization will use for transactions.
        </p>
      </div>

      {activeMethod && (
        <Card className=" bg-card glow">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="flex items-center gap-2">
                  {getPaymentMethodDisplayInfo(activeMethod.method).icon}
                  Active: {activeMethod.displayName}
                </CardTitle>
                <CardDescription>
                  {activeMethod.description}
                </CardDescription>
              </div>
              <div className="flex items-center gap-2">
                <Label htmlFor="active-payment-method" className="text-sm font-medium">
                  Switch to:
                </Label>
                <Select
                  value={activeMethod.method}
                  onValueChange={(value: PaymentMethod) => {
                    if (value !== activeMethod.method) {
                      handleMethodSelect(value);
                    }
                  }}
                  disabled={isLoading}
                >
                  <SelectTrigger id="active-payment-method" className="w-40">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {availableMethods.map((method) => {
                      const displayInfo = getPaymentMethodDisplayInfo(method.method);
                      return (
                        <SelectItem key={method.method} value={method.method}>
                          <div className="flex items-center gap-2">
                            <span>{displayInfo.icon}</span>
                            <span>{method.displayName}</span>
                            {!method.isConfigured && (
                              <Badge variant="outline" className="ml-2 text-xs">
                                Not Configured
                              </Badge>
                            )}
                          </div>
                        </SelectItem>
                      );
                    })}
                  </SelectContent>
                </Select>
              </div>
            </div>
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
                  ? 'bg-card glow' 
                  : 'border-none'
              }`}
              onClick={() => setSelectedMethod(method.method)}
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
                        onCheckedChange={(checked) => {
                          if (checked) {
                            handleMethodSelect(method.method);
                          }
                        }}
                      />
                      <span className="text-sm">
                        {isActive ? 'Active' : method.isConfigured ? 'Inactive' : 'Not Configured'}
                      </span>
                    </div>
                  </div>
                  
                  <Button 
                    variant={method.isConfigured ? "default" : "outline"}
                    size="sm"
                    onClick={(e) => {
                      e.stopPropagation();
                      setSelectedMethod(method.method);
                    }}
                    className="w-full"
                  >
                    {method.isConfigured ? `Configure ${method.displayName}` : `Set up ${method.displayName}`}
                  </Button>
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
};

// M-Pesa Configuration Form Component
const MpesaConfigurationForm = ({ 
  form, 
  onSubmit, 
  showSensitive, 
  setShowSensitive, 
  isLoading, 
  canManage, 
  mpesaConfig 
}: {
  form: ReturnType<typeof useForm<MpesaFormInputs>>;
  onSubmit: SubmitHandler<MpesaFormInputs>;
  showSensitive: boolean;
  setShowSensitive: (show: boolean) => void;
  isLoading: boolean;
  canManage: boolean;
  mpesaConfig: MpesaConfig;
}) => {
  const { register, handleSubmit, setValue, formState: { errors } } = form;

     return (
        <form onSubmit={handleSubmit(onSubmit)}>
          <Card>
            <CardHeader>
              <CardTitle>M-Pesa Configuration</CardTitle>
              <CardDescription>
                Enter your M-Pesa API credentials and configuration details
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
                    disabled={!canManage}
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
                    disabled={!canManage}
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
                    disabled={!canManage}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="environment">Environment</Label>
                  <Select
                    defaultValue={mpesaConfig.environment || "sandbox"}
                    onValueChange={(value) => setValue("environment", value)}
                    disabled={!canManage}
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
                    disabled={!canManage}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="consumerSecret">Consumer Secret</Label>
                  <Input
                    id="consumerSecret"
                    placeholder="Daraja API Consumer Secret"
                    type={showSensitive ? "text" : "password"}
                    {...register("consumerSecret")}
                    disabled={!canManage}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="passKey">Pass Key</Label>
                  <Input
                    id="passKey"
                    placeholder="Pass Key for STK Push"
                    type={showSensitive ? "text" : "password"}
                    {...register("passKey")}
                    disabled={!canManage}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="transactionType">Transaction Type</Label>
                  <Select
                    defaultValue={mpesaConfig.transactionType || "CustomerPayBillOnline"}
                    onValueChange={(value) => setValue("transactionType", value)}
                    disabled={!canManage}
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
                    disabled={!canManage}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="stkPushPassKey">STK Push Pass Key</Label>
                  <Input
                    id="stkPushPassKey"
                    placeholder="Leave empty to use main Pass Key"
                    type={showSensitive ? "text" : "password"}
                    {...register("stkPushPassKey")}
                    disabled={!canManage}
                  />
                </div>
              </div>
            </CardContent>
            <CardFooter className="flex justify-between">
              <Button variant="outline" type="reset" disabled={!canManage || isLoading}>
                Cancel
              </Button>
              <Button type="submit" disabled={!canManage || isLoading}>
                {isLoading ? "Saving..." : "Save Changes"}
              </Button>
            </CardFooter>
          </Card>
                 </form>
  );
};

// KopoKopo Configuration Form Component
const KopoKopoConfigurationForm = ({ 
  form, 
  onSubmit, 
  showSensitive, 
  setShowSensitive, 
  isLoading, 
  canManage, 
  kopokopoConfig
}: {
  form: ReturnType<typeof useForm<KopoKopoFormInputs>>;
  onSubmit: SubmitHandler<KopoKopoFormInputs>;
  showSensitive: boolean;
  setShowSensitive: (show: boolean) => void;
  isLoading: boolean;
  canManage: boolean;
  kopokopoConfig: KopoKopoConfig;
}) => {
  const { register, handleSubmit, setValue, formState: { errors } } = form;

     return (
        <form onSubmit={handleSubmit(onSubmit)}>
          <Card>
            <CardHeader>
              <CardTitle>KopoKopo Configuration</CardTitle>
              <CardDescription>
                Enter your KopoKopo API credentials and configuration details
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="bg-blue-50 border border-blue-200 p-4 rounded-md">
                <div className="flex gap-2">
                  <InfoIcon className="h-5 w-5 text-blue-500" />
                  <div>
                    <h3 className="font-medium text-blue-800">Automatic Setup</h3>
                    <p className="text-blue-700 text-sm">
                      When you save your configuration, webhooks are automatically registered with KopoKopo. 
                      No manual setup required in the KopoKopo dashboard.
                    </p>
                  </div>
                </div>
              </div>
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="clientId">Client ID <span className="text-red-500">*</span></Label>
                  <Input
                    id="clientId"
                    placeholder="Your KopoKopo Client ID"
                    {...register("clientId", { required: "Client ID is required" })}
                    disabled={!canManage}
                  />
                  {errors.clientId && (
                    <p className="text-sm text-red-500">{errors.clientId.message}</p>
                  )}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="environment">Environment</Label>
                  <Select
                    defaultValue={kopokopoConfig.environment || "sandbox"}
                    onValueChange={(value) => setValue("environment", value)}
                    disabled={!canManage}
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

                <div className="space-y-2">
                  <Label htmlFor="businessName">Business Name <span className="text-red-500">*</span></Label>
                  <Input
                    id="businessName"
                    placeholder="Your business name"
                    {...register("businessName", { required: "Business name is required" })}
                    disabled={!canManage}
                  />
                  {errors.businessName && (
                    <p className="text-sm text-red-500">{errors.businessName.message}</p>
                  )}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="tillNumber">Till Number <span className="text-red-500">*</span></Label>
                  <Input
                    id="tillNumber"
                    placeholder="Your KopoKopo Till Number"
                    {...register("tillNumber", { required: "Till Number is required" })}
                    disabled={!canManage}
                  />
                  {errors.tillNumber && (
                    <p className="text-sm text-red-500">{errors.tillNumber.message}</p>
                  )}
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
                  <Label htmlFor="clientSecret">Client Secret</Label>
                  <Input
                    id="clientSecret"
                    placeholder="Your KopoKopo Client Secret"
                    type={showSensitive ? "text" : "password"}
                    {...register("clientSecret")}
                    disabled={!canManage}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="webhookSecret">Webhook Secret</Label>
                  <Input
                    id="webhookSecret"
                    placeholder="Webhook secret for signature validation"
                    type={showSensitive ? "text" : "password"}
                    {...register("webhookSecret")}
                    disabled={!canManage}
                  />
                </div>
              </div>
            </CardContent>
            <CardFooter className="flex justify-between">
              <Button variant="outline" type="reset" disabled={!canManage || isLoading}>
                Cancel
              </Button>
              <Button type="submit" disabled={!canManage || isLoading}>
                {isLoading ? "Saving..." : "Save Changes"}
              </Button>
            </CardFooter>
          </Card>
                 </form>
  );
};
