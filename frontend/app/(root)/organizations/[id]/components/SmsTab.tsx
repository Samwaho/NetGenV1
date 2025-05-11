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
  
  // Check if user has permissions to manage SMS
  const userMember = organization.members.find(
    (member) => member?.user?.id === currentUserId && member.status === "ACTIVE"
  );

  const canManageSms = userMember && hasOrganizationPermissions(
    organization,
    currentUserId,
    OrganizationPermissions.MANAGE_SMS_CONFIG
  );

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

  // Helper function to format date


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
    <div className="space-y-6">
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
    </div>
  );
}
