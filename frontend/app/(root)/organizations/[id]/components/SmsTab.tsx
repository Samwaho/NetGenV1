"use client";

import { useState, useMemo } from "react";
import { Organization } from "@/types/organization";
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card";
import { AlertCircle, InfoIcon, MessageSquare, Edit, ExternalLink } from "lucide-react";
import SmsConfigForm from "@/app/(root)/organizations/[id]/components/SmsConfigForm";
import { hasOrganizationPermissions } from "@/lib/permission-utils";
import { OrganizationPermissions } from "@/lib/permissions";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { format } from "date-fns";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { motion } from "framer-motion";
import { formatDateToNowInTimezone } from "@/lib/utils";
import { useQuery } from "@apollo/client";
import { GET_SMS_TEMPLATES } from "@/graphql/sms_templates";
import SmsTemplateForm from "./SmsTemplateForm";
import { TemplateCategory } from "@/types/sms_template";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";

interface SmsTabProps {
  organization: Organization;
  organizationId: string;
  currentUserId: string;
}

// Provider information
const PROVIDERS = [
  { value: 'africastalking', label: "Africa's Talking", logo: "https://africastalking.com/img/favicons/favicon-32x32.png" },
  { value: 'twilio', label: "Twilio", logo: "https://www.twilio.com/assets/icons/twilio-icon-512.png" },
  { value: 'vonage', label: "Vonage", logo: "https://developer.nexmo.com/favicon.ico" },
  { value: 'textsms', label: "TextSMS", logo: "https://textsms.co.ke/wp-content/uploads/textsms_logo.png" },
  { value: 'zettatel', label: "Zettatel", logo: "https://www.zettatel.com/wp-content/uploads/2021/04/favicon-1.png" }
];

export function SmsTab({ organization, organizationId, currentUserId }: SmsTabProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [showTemplateForm, setShowTemplateForm] = useState(false);
  const [editTemplate, setEditTemplate] = useState<any | null>(null);
  // Check if user has permissions to manage SMS
  const userMember = organization.members.find(
    (member) => member?.user?.id === currentUserId && member.status === "ACTIVE"
  );

  const canManageSms = userMember && hasOrganizationPermissions(
    organization,
    currentUserId,
    OrganizationPermissions.MANAGE_SMS_CONFIG
  );

  const { data, loading, error, refetch } = useQuery(GET_SMS_TEMPLATES, {
    variables: { organizationId },
    skip: !canManageSms,
    fetchPolicy: "cache-and-network"
  });
  
  // Make sure we have the complete SMS config
  const smsConfig = organization.smsConfig || {};

  const handleConfigUpdated = () => {
    setIsEditing(false);
  };

  // Helper function to get provider display name
  const getProviderDisplayName = (provider: string | undefined) => {
    const providerInfo = PROVIDERS.find(p => p.value === provider?.toLowerCase());
    return providerInfo ? providerInfo.label : provider || "Not configured";
  };

  // Helper function to get provider logo
  const getProviderLogo = (provider: string | undefined) => {
    const providerInfo = PROVIDERS.find(p => p.value === provider?.toLowerCase());
    return providerInfo ? providerInfo.logo : undefined;
  };

  // Helper function to get provider-specific configuration details
  const getProviderDetails = (config: any) => {
    if (!config) return [];
    
    const details = [];
    
    switch (config.provider?.toLowerCase()) {
      case 'africastalking':
        if (config.username) details.push({ label: "Username", value: config.username });
        if (config.senderId) details.push({ label: "Sender ID", value: config.senderId });
        break;
      case 'twilio':
        if (config.accountSid) details.push({ label: "Account SID", value: `${config.accountSid.substring(0, 8)}...` });
        if (config.senderId) details.push({ label: "Phone Number", value: config.senderId });
        break;
      case 'vonage':
        if (config.apiKey) details.push({ label: "API Key", value: `${config.apiKey.substring(0, 8)}...` });
        if (config.senderId) details.push({ label: "Sender ID", value: config.senderId });
        break;
      case 'textsms':
        if (config.partnerID) details.push({ label: "Partner ID", value: config.partnerID });
        break;
      case 'zettatel':
        if (config.username) details.push({ label: "Username", value: config.username });
        if (config.password) details.push({ label: "Password", value: "••••••••" });
        if (config.senderId) details.push({ label: "Sender ID", value: config.senderId });
        break;
    }
    
    return details;
  };

  // Helper function to get environment display name
  const getEnvironmentDisplayName = (env: string | undefined) => {
    switch (env?.toLowerCase()) {
      case 'sandbox': return "Sandbox (Testing)";
      case 'production': return "Production (Live)";
      default: return env || "Not set";
    }
  };

  if (!canManageSms) {
    return (
      <Card className="border-red-200">
        <CardContent className="pt-6">
          <div className="flex gap-2 text-red-500">
            <AlertCircle className="h-5 w-5" />
            <div>
              <h3 className="font-medium">Access Denied</h3>
              <p className="text-sm">
                You don't have permission to manage SMS configuration.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Tabs defaultValue="config" className="space-y-6">
      <TabsList className="mb-4">
        <TabsTrigger value="config">Configuration</TabsTrigger>
        <TabsTrigger value="templates">Templates</TabsTrigger>
      </TabsList>
      <TabsContent value="config">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">SMS Integration</h2>
          <p className="text-muted-foreground">
            Configure SMS services for your organization to send notifications and alerts
          </p>
        </div>

        <div className="bg-blue-50 border border-blue-200 p-4 rounded-md">
          <div className="flex gap-2">
            <InfoIcon className="h-5 w-5 text-blue-500" />
            <div>
              <h3 className="font-medium text-blue-800">Information</h3>
              <p className="text-blue-700 text-sm">
                SMS services allow you to send automated messages to your customers.
              </p>
            </div>
          </div>
        </div>

        {organization.smsConfig && !isEditing ? (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3 }}
          >
            <Card className="shadow-md border-opacity-50">
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    <MessageSquare className="h-5 w-5 text-primary" />
                    <CardTitle>SMS Configuration</CardTitle>
                  </div>
                  <Badge
                    variant={organization.smsConfig.isActive ? "default" : "secondary"}
                    className={organization.smsConfig.isActive
                      ? "bg-green-100 text-green-800 hover:bg-green-200"
                      : "bg-gray-100 text-gray-800 hover:bg-gray-200"}
                  >
                    {organization.smsConfig.isActive ? "Active" : "Inactive"}
                  </Badge>
                </div>
                <CardDescription>
                  Your current SMS provider configuration
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="flex items-center gap-3 p-3 bg-muted/30 rounded-lg">
                  {getProviderLogo(organization.smsConfig.provider) && (
                    <img 
                      src={getProviderLogo(organization.smsConfig.provider)} 
                      alt={getProviderDisplayName(organization.smsConfig.provider)} 
                      className="w-8 h-8 object-contain"
                    />
                  )}
                  <div>
                    <h3 className="font-medium">{getProviderDisplayName(organization.smsConfig.provider)}</h3>
                    <p className="text-sm text-muted-foreground">
                      {organization.smsConfig.environment === 'production' ? 'Production Environment' : 'Sandbox Environment'}
                    </p>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-4">
                    {getProviderDetails(organization.smsConfig).map((detail, index) => (
                      <div key={index} className="border-b pb-2 last:border-0">
                        <h3 className="text-sm font-medium text-muted-foreground mb-1">{detail.label}</h3>
                        <p className="text-base font-medium break-words">{detail.value}</p>
                      </div>
                    ))}

                    {organization.smsConfig.senderId && !getProviderDetails(organization.smsConfig).some(d => d.label === "Sender ID") && (
                      <div className="border-b pb-2 last:border-0">
                        <h3 className="text-sm font-medium text-muted-foreground mb-1">Sender ID</h3>
                        <p className="text-base font-medium break-words">{organization.smsConfig.senderId}</p>
                      </div>
                    )}
                  </div>

                  <div className="space-y-4">
                    <div className="border-b pb-2 last:border-0">
                      <h3 className="text-sm font-medium text-muted-foreground mb-1">Last Updated</h3>
                      <p className="text-base font-medium">{formatDateToNowInTimezone(organization.smsConfig.updatedAt)}</p>
                    </div>

                    {organization.smsConfig.callbackUrl && (
                      <div className="border-b pb-2 last:border-0">
                        <h3 className="text-sm font-medium text-muted-foreground mb-1">Callback URL</h3>
                        <p className="text-sm font-medium text-blue-600 flex items-center gap-1 break-all">
                          {organization.smsConfig.callbackUrl}
                          <ExternalLink className="h-3.5 w-3.5 flex-shrink-0" />
                        </p>
                      </div>
                    )}
                  </div>
                </div>

                {organization.smsConfig.environment === 'sandbox' && (
                  <Alert variant="warning" className="bg-amber-50 text-amber-800 border-amber-200">
                    <AlertCircle className="h-4 w-4" />
                    <AlertDescription>
                      You are in sandbox mode. SMS messages will not be sent to real recipients.
                    </AlertDescription>
                  </Alert>
                )}
              </CardContent>
              <CardFooter className="flex justify-between border-t p-4 bg-muted/10">
                <div className="text-sm text-muted-foreground">
                  <span className="flex items-center gap-1">
                    <InfoIcon className="h-4 w-4" />
                    You can change providers by clicking Edit
                  </span>
                </div>
                <Button
                  onClick={() => setIsEditing(true)}
                  className="flex items-center gap-1"
                  disabled={!canManageSms}
                >
                  <Edit className="h-4 w-4" />
                  Edit Configuration
                </Button>
              </CardFooter>
            </Card>
          </motion.div>
        ) : (
          <SmsConfigForm
            config={organization.smsConfig || null}
            organizationId={organizationId}
            onConfigUpdated={handleConfigUpdated}
          />
        )}
      </TabsContent>
      <TabsContent value="templates">
        <Card className="shadow-md border-opacity-50">
          <CardHeader className="pb-3 flex flex-col md:flex-row md:items-center md:justify-between gap-2">
            <div>
              <CardTitle>SMS Templates</CardTitle>
              <CardDescription>
                Manage and create SMS templates for your organization. Templates help you send consistent, personalized messages to your customers.
              </CardDescription>
            </div>
            <Button onClick={() => setShowTemplateForm(true)} size="sm">New Template</Button>
          </CardHeader>
          <CardContent className="space-y-6">
            <Dialog open={showTemplateForm} onOpenChange={setShowTemplateForm}>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>New SMS Template</DialogTitle>
                </DialogHeader>
                <SmsTemplateForm
                  organizationId={organizationId}
                  onCreated={() => {
                    setShowTemplateForm(false);
                    refetch();
                  }}
                  onCancel={() => setShowTemplateForm(false)}
                />
              </DialogContent>
            </Dialog>
            <Dialog open={!!editTemplate} onOpenChange={open => { if (!open) setEditTemplate(null); }}>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Edit SMS Template</DialogTitle>
                </DialogHeader>
                {editTemplate && (
                  <SmsTemplateForm
                    organizationId={organizationId}
                    template={editTemplate}
                    onUpdated={() => {
                      setEditTemplate(null);
                      refetch();
                    }}
                    onCancel={() => setEditTemplate(null)}
                  />
                )}
              </DialogContent>
            </Dialog>
            {loading ? (
              <div className="text-muted-foreground">Loading templates...</div>
            ) : error ? (
              <div className="text-red-500">Error loading templates</div>
            ) : (
              <div className="divide-y">
                {(data?.listSmsTemplates?.templates || []).length === 0 ? (
                  <div className="p-4 text-muted-foreground">No templates found.</div>
                ) : (
                  data.listSmsTemplates.templates.map((tpl: any) => (
                    <div key={tpl.id} className="py-4 flex flex-col md:flex-row md:items-center md:justify-between gap-2">
                      <div>
                        <div className="font-medium text-base">{tpl.name}</div>
                        <div className="text-xs text-muted-foreground mb-1">{tpl.category.replace(/_/g, " ")}</div>
                        <div className="text-xs text-muted-foreground line-clamp-1 max-w-xs">{tpl.description}</div>
                      </div>
                      <div className="flex items-center gap-4">
                        <Badge variant={tpl.isActive ? "default" : "secondary"} className={tpl.isActive ? "bg-green-100 text-green-800 hover:bg-green-200" : "bg-gray-100 text-gray-800 hover:bg-gray-200"}>
                          {tpl.isActive ? "Active" : "Inactive"}
                        </Badge>
                        <span className="text-xs text-muted-foreground">{tpl.createdAt ? new Date(tpl.createdAt).toLocaleDateString() : ""}</span>
                        <Button size="icon" variant="ghost" onClick={() => setEditTemplate(tpl)} title="Edit template">
                          <Edit className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            )}
          </CardContent>
        </Card>
      </TabsContent>
    </Tabs>
  );
}
