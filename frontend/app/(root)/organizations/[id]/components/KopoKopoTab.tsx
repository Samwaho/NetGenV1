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
import { UPDATE_KOPOKOPO_CONFIGURATION } from "@/graphql/organization";
import { Separator } from "@/components/ui/separator";
import { hasOrganizationPermissions } from "@/lib/permission-utils";
import { OrganizationPermissions } from "@/lib/permissions";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { InfoIcon, AlertCircle } from "lucide-react";
import { isPaymentMethodActive, PaymentMethod } from "@/lib/payment-utils";

interface KopoKopoTabProps {
  organization: Organization;
  organizationId: string;
  currentUserId: string;
}

interface KopoKopoFormInputs {
  clientId: string;
  clientSecret: string;
  environment: string;
  webhookSecret: string;
  isActive: boolean;
}

export const KopoKopoTab = ({ organization, organizationId, currentUserId }: KopoKopoTabProps) => {
  const [saving, setSaving] = useState(false);
  const [showSensitive, setShowSensitive] = useState(false);
  
  const canManageKopoKopo = hasOrganizationPermissions(
    organization,
    currentUserId,
    OrganizationPermissions.MANAGE_KOPOKOPO_CONFIG
  );
  
  const kopokopoConfig = organization.kopokopoConfig || {
    clientId: "",
    clientSecret: "",
    environment: "sandbox",
    webhookSecret: "",
    isActive: false,
    baseUrl: "",
    createdAt: "",
    updatedAt: ""
  };

  const { register, handleSubmit, setValue, watch, formState: { errors } } = useForm<KopoKopoFormInputs>({
    defaultValues: {
      clientId: kopokopoConfig.clientId || "",
      clientSecret: kopokopoConfig.clientSecret || "",
      environment: kopokopoConfig.environment || "sandbox",
      webhookSecret: kopokopoConfig.webhookSecret || "",
      isActive: kopokopoConfig.isActive || false
    }
  });

  const [updateKopoKopoConfig] = useMutation(UPDATE_KOPOKOPO_CONFIGURATION, {
    onCompleted: () => {
      setSaving(false);
      toast.success("KopoKopo configuration has been updated.");
    },
    onError: (error) => {
      setSaving(false);
      toast.error(error.message || "Failed to update KopoKopo configuration");
    }
  });

  const onSubmit: SubmitHandler<KopoKopoFormInputs> = async (data) => {
    if (!canManageKopoKopo) {
      toast.error("You don't have permission to manage KopoKopo configuration");
      return;
    }

    setSaving(true);
    try {
      await updateKopoKopoConfig({
        variables: {
          organizationId,
          input: {
            clientId: data.clientId,
            clientSecret: data.clientSecret,
            environment: data.environment,
            webhookSecret: data.webhookSecret || undefined,
            isActive: data.isActive
          }
        }
      });
    } catch (error) {
      console.error("Error updating KopoKopo configuration:", error);
    }
  };

  const isKopoKopoActive = isPaymentMethodActive(organization, 'KOPOKOPO' as PaymentMethod);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">KopoKopo Integration</h2>
          <p className="text-muted-foreground">
            Configure KopoKopo payment integration for your organization
          </p>
        </div>
      </div>

      {isKopoKopoActive && (
        <div className="bg-green-50 border border-green-200 p-4 rounded-md">
          <div className="flex gap-2">
            <InfoIcon className="h-5 w-5 text-green-500" />
            <div>
              <h3 className="font-medium text-green-800">KopoKopo is Active</h3>
              <p className="text-green-700 text-sm">
                KopoKopo is currently the active payment method for this organization.
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
              KopoKopo provides a unified payment gateway for M-Pesa and other payment methods. 
              You'll need to register your webhook URLs in the KopoKopo dashboard.
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
              To activate KopoKopo as your payment method, use the Payment Method selector in the main organization settings. 
              This configuration only sets up the KopoKopo integration details.
            </p>
          </div>
        </div>
      </div>

      <Tabs defaultValue="settings" className="space-y-4">
        <TabsList>
          <TabsTrigger value="settings">Settings</TabsTrigger>
          <TabsTrigger value="webhooks">Webhook URLs</TabsTrigger>
        </TabsList>
        
        <TabsContent value="settings">
          <form onSubmit={handleSubmit(onSubmit)}>
            <Card>
              <CardHeader>
                <CardTitle>KopoKopo Configuration</CardTitle>
                <CardDescription>
                  Enter your KopoKopo API credentials and configuration details
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="clientId">Client ID <span className="text-red-500">*</span></Label>
                    <Input
                      id="clientId"
                      placeholder="Your KopoKopo Client ID"
                      {...register("clientId", { required: "Client ID is required" })}
                      disabled={!canManageKopoKopo}
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
                      disabled={!canManageKopoKopo}
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
                    <Label htmlFor="clientSecret">Client Secret</Label>
                    <Input
                      id="clientSecret"
                      placeholder="Your KopoKopo Client Secret"
                      type={showSensitive ? "text" : "password"}
                      {...register("clientSecret")}
                      disabled={!canManageKopoKopo}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="webhookSecret">Webhook Secret</Label>
                    <Input
                      id="webhookSecret"
                      placeholder="Webhook secret for signature validation"
                      type={showSensitive ? "text" : "password"}
                      {...register("webhookSecret")}
                      disabled={!canManageKopoKopo}
                    />
                  </div>
                </div>
              </CardContent>
              <CardFooter className="flex justify-between">
                <Button variant="outline" type="reset" disabled={!canManageKopoKopo || saving}>
                  Cancel
                </Button>
                <Button type="submit" disabled={!canManageKopoKopo || saving}>
                  {saving ? "Saving..." : "Save Changes"}
                </Button>
              </CardFooter>
            </Card>
          </form>
        </TabsContent>

        <TabsContent value="webhooks">
          <Card>
            <CardHeader>
              <CardTitle>Webhook URLs</CardTitle>
              <CardDescription>
                These webhook URLs need to be registered in your KopoKopo dashboard for real-time payment notifications.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label>Buy Goods Transaction Webhook</Label>
                  <div className="flex items-center gap-2">
                    <Input
                      value={`${process.env.NEXT_PUBLIC_API_URL || 'https://your-domain.com'}/api/payments/kopokopo/callback/${organizationId}/buygoods`}
                      readOnly
                      className="font-mono text-xs"
                    />
                    <Button 
                      variant="outline" 
                      onClick={() => {
                        navigator.clipboard.writeText(`${process.env.NEXT_PUBLIC_API_URL || 'https://your-domain.com'}/api/payments/kopokopo/callback/${organizationId}/buygoods`);
                        toast.success("URL copied to clipboard");
                      }}
                    >
                      Copy
                    </Button>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label>B2B Transaction Webhook</Label>
                  <div className="flex items-center gap-2">
                    <Input
                      value={`${process.env.NEXT_PUBLIC_API_URL || 'https://your-domain.com'}/api/payments/kopokopo/callback/${organizationId}/b2b`}
                      readOnly
                      className="font-mono text-xs"
                    />
                    <Button 
                      variant="outline" 
                      onClick={() => {
                        navigator.clipboard.writeText(`${process.env.NEXT_PUBLIC_API_URL || 'https://your-domain.com'}/api/payments/kopokopo/callback/${organizationId}/b2b`);
                        toast.success("URL copied to clipboard");
                      }}
                    >
                      Copy
                    </Button>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label>Settlement Transfer Webhook</Label>
                  <div className="flex items-center gap-2">
                    <Input
                      value={`${process.env.NEXT_PUBLIC_API_URL || 'https://your-domain.com'}/api/payments/kopokopo/callback/${organizationId}/settlement`}
                      readOnly
                      className="font-mono text-xs"
                    />
                    <Button 
                      variant="outline" 
                      onClick={() => {
                        navigator.clipboard.writeText(`${process.env.NEXT_PUBLIC_API_URL || 'https://your-domain.com'}/api/payments/kopokopo/callback/${organizationId}/settlement`);
                        toast.success("URL copied to clipboard");
                      }}
                    >
                      Copy
                    </Button>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label>Customer Created Webhook</Label>
                  <div className="flex items-center gap-2">
                    <Input
                      value={`${process.env.NEXT_PUBLIC_API_URL || 'https://your-domain.com'}/api/payments/kopokopo/callback/${organizationId}/customer`}
                      readOnly
                      className="font-mono text-xs"
                    />
                    <Button 
                      variant="outline" 
                      onClick={() => {
                        navigator.clipboard.writeText(`${process.env.NEXT_PUBLIC_API_URL || 'https://your-domain.com'}/api/payments/kopokopo/callback/${organizationId}/customer`);
                        toast.success("URL copied to clipboard");
                      }}
                    >
                      Copy
                    </Button>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};
