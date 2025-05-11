import React, { useState, useEffect } from 'react';
import { SmsConfig } from '@/types/organization';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardFooter, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { useMutation } from '@apollo/client';
import { UPDATE_SMS_CONFIGURATION, GET_ORGANIZATION } from '@/graphql/organization';
import { toast } from 'sonner';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Separator } from '@/components/ui/separator';
import { AlertCircle, CheckCircle2, MessageSquare, Info, AlertTriangle, Eye, EyeOff } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { motion } from 'framer-motion';
import { useForm, Controller, SubmitHandler, ControllerRenderProps } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';

// Add a PasswordInput component with proper TypeScript types
interface PasswordInputProps {
  field: ControllerRenderProps<FormValues, any>;
  id: string;
  placeholder: string;
  required?: boolean;
  className?: string;
}

const PasswordInput: React.FC<PasswordInputProps> = ({ field, id, placeholder, required, className }) => {
  const [showPassword, setShowPassword] = useState(false);
  
  return (
    <div className="relative">
      <Input
        id={id}
        {...field}
        placeholder={placeholder}
        type={showPassword ? "text" : "password"}
        className={className}
        required={required}
      />
      <button
        type="button"
        className="absolute inset-y-0 right-0 flex items-center pr-3"
        onClick={() => setShowPassword(!showPassword)}
      >
        {showPassword ? (
          <EyeOff className="h-4 w-4 text-gray-500" />
        ) : (
          <Eye className="h-4 w-4 text-gray-500" />
        )}
      </button>
    </div>
  );
};

interface SmsConfigFormProps {
  config: SmsConfig | null;
  organizationId: string;
  onConfigUpdated?: () => void;
}

// Define form schema with Zod
const formSchema = z.object({
  provider: z.string().min(1, "Provider is required"),
  isActive: z.boolean(),
  apiKey: z.string().optional(),
  apiSecret: z.string().optional(),
  username: z.string().optional(),
  accountSid: z.string().optional(),
  authToken: z.string().optional(),
  senderId: z.string().optional(),
  partnerID: z.string().optional(),
  environment: z.string().default("sandbox"),
  password: z.string().optional(),
  msgType: z.string().optional(),
});

type FormValues = z.infer<typeof formSchema>;

// Provider information
const PROVIDERS = [
  { value: 'africastalking', label: "Africa's Talking", logo: "https://africastalking.com/img/favicons/favicon-32x32.png" },
  { value: 'twilio', label: "Twilio", logo: "https://www.twilio.com/assets/icons/twilio-icon-512.png" },
  { value: 'vonage', label: "Vonage", logo: "https://developer.nexmo.com/favicon.ico" },
  { value: 'textsms', label: "TextSMS", logo: "https://textsms.co.ke/wp-content/uploads/textsms_logo.png" },
  { value: 'zettatel', label: "Zettatel", logo: "https://www.zettatel.com/wp-content/uploads/2021/04/favicon-1.png" },
];

const SmsConfigForm: React.FC<SmsConfigFormProps> = ({
  config,
  organizationId,
  onConfigUpdated
}) => {
  const [showProviderChangeWarning, setShowProviderChangeWarning] = useState<boolean>(false);
  const [activeTab, setActiveTab] = useState<string>(config?.provider || 'africastalking');


  // Initialize form with react-hook-form
  const { control, handleSubmit, watch, setValue, formState: { errors } } = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      provider: config?.provider || 'africastalking',
      isActive: config?.isActive || false,
      apiKey: config?.apiKey || '',
      apiSecret: config?.apiSecret || '',
      username: config?.username || '',
      accountSid: config?.accountSid || '',
      authToken: config?.authToken || '',
      senderId: config?.senderId || '',
      partnerID: config?.partnerID || '',
      environment: config?.environment || 'sandbox',
      password: config?.password || '', // Initialize from config if available
      msgType: 'text', // Add default value as it's not in SmsConfig
    }
  });

  // Watch values for conditional rendering
  const provider = watch('provider');
  const environment = watch('environment');

  // Update active tab when provider changes
  useEffect(() => {
    setActiveTab(provider);
  }, [provider]);

  // Helper function to get provider info
  const getProviderInfo = (providerValue: string) => {
    return PROVIDERS.find(p => p.value === providerValue) || PROVIDERS[0];
  };

  // Handle provider change
  const handleProviderChange = (newProvider: string) => {
    if (config && config.provider && newProvider !== config.provider) {
      setShowProviderChangeWarning(true);
    }
    setValue('provider', newProvider);
    setActiveTab(newProvider);
  };

  const [updateSmsConfiguration, { loading }] = useMutation(UPDATE_SMS_CONFIGURATION, {
    refetchQueries: [
      {
        query: GET_ORGANIZATION,
        variables: { id: organizationId }
      }
    ],
    onCompleted: (data) => {
      if (data?.updateSmsConfiguration?.success) {
        toast.success('SMS configuration updated successfully');
        if (onConfigUpdated) {
          onConfigUpdated();
        }
      } else {
        toast.error(data?.updateSmsConfiguration?.message || 'Failed to update SMS configuration');
      }
    },
    onError: (error) => {
      toast.error('An error occurred while updating SMS configuration');
      console.error(error);
    }
  });

  const onSubmit: SubmitHandler<FormValues> = async (data) => {
    try {
      await updateSmsConfiguration({
        variables: {
          organizationId,
          input: {
            provider: data.provider,
            isActive: data.isActive,
            apiKey: data.apiKey || undefined,
            apiSecret: data.apiSecret || undefined,
            username: data.username || undefined,
            accountSid: data.accountSid || undefined,
            authToken: data.authToken || undefined,
            senderId: data.senderId || undefined,
            partnerID: data.partnerID || undefined,
            environment: data.environment,
            password: data.password || undefined,
            msgType: data.msgType || undefined,
          }
        }
      });
    } catch (error) {
      toast.error('An error occurred while updating SMS configuration');
      console.error(error);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
    >
      <Card className="shadow-md border-opacity-50">
        <CardHeader className="pb-3">
          <div className="flex items-center space-x-2">
            <MessageSquare className="h-5 w-5 text-primary" />
            <CardTitle>{config ? 'Edit SMS Configuration' : 'New SMS Configuration'}</CardTitle>
          </div>
          <CardDescription>
            {config 
              ? `Update your ${getProviderInfo(config.provider || '').label} configuration settings.`
              : 'Configure your SMS provider to enable sending messages to your customers.'}
          </CardDescription>
        </CardHeader>
        <form onSubmit={handleSubmit(onSubmit)}>
          <CardContent className="space-y-6">
            {/* If there's an existing config, show a banner with the current provider */}
            {config && (
              <div className="flex items-center gap-3 p-3 bg-blue-50 border border-blue-100 rounded-lg">
                <img 
                  src={getProviderInfo(config.provider || '').logo} 
                  alt={getProviderInfo(config.provider || '').label} 
                  className="w-6 h-6 object-contain"
                />
                <div className="flex-1">
                  <p className="text-sm text-blue-800">
                    You are editing your <span className="font-medium">{getProviderInfo(config.provider || '').label}</span> configuration.
                  </p>
                </div>
                <CheckCircle2 className="h-5 w-5 text-blue-500" />
              </div>
            )}

            {/* Show warning when changing providers */}
            {showProviderChangeWarning && (
              <Alert variant="warning" className="bg-amber-50 text-amber-800 border-amber-200">
                <AlertTriangle className="h-4 w-4" />
                <AlertDescription>
                  Changing providers will reset your current configuration. Make sure to save your new settings.
                </AlertDescription>
              </Alert>
            )}

            <div className="flex flex-col md:flex-row justify-between md:items-center gap-4 p-4 bg-muted/50 rounded-lg">
              <div className="space-y-1">
                <h3 className="text-sm font-medium">SMS Service Status</h3>
                <p className="text-xs text-muted-foreground">
                  {watch('isActive') ? 'SMS service is currently active' : 'SMS service is currently inactive'}
                </p>
              </div>
              <div className="flex items-center space-x-2">
                <Controller
                  name="isActive"
                  control={control}
                  render={({ field }) => (
                    <Switch
                      id="isActive"
                      checked={field.value}
                      onCheckedChange={field.onChange}
                      className="data-[state=checked]:bg-green-500"
                    />
                  )}
                />
                <Label htmlFor="isActive" className="font-medium">
                  {watch('isActive') ? 'Active' : 'Inactive'}
                </Label>
              </div>
            </div>

            <div className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="provider" className="text-sm font-medium">Provider</Label>
                  <Controller
                    name="provider"
                    control={control}
                    render={({ field }) => (
                      <Select
                        value={field.value}
                        onValueChange={handleProviderChange}
                      >
                        <SelectTrigger id="provider" className="w-full">
                          <SelectValue placeholder="Select a provider" />
                        </SelectTrigger>
                        <SelectContent>
                          {PROVIDERS.map(provider => (
                            <SelectItem key={provider.value} value={provider.value}>
                              {provider.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    )}
                  />
                  {errors.provider && (
                    <p className="text-sm text-red-500">{errors.provider.message}</p>
                  )}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="environment" className="text-sm font-medium">Environment</Label>
                  <Controller
                    name="environment"
                    control={control}
                    render={({ field }) => (
                      <Select
                        value={field.value}
                        onValueChange={field.onChange}
                      >
                        <SelectTrigger id="environment" className="w-full">
                          <SelectValue placeholder="Select environment" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="sandbox">Sandbox (Testing)</SelectItem>
                          <SelectItem value="production">Production (Live)</SelectItem>
                        </SelectContent>
                      </Select>
                    )}
                  />
                </div>
              </div>

              {environment === 'sandbox' && (
                <Alert variant="warning" className="bg-amber-50 text-amber-800 border-amber-200">
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>
                    You are in sandbox mode. SMS messages will not be sent to real recipients.
                  </AlertDescription>
                </Alert>
              )}
            </div>

            <Separator className="my-4" />

            <Tabs value={activeTab} onValueChange={handleProviderChange} className="w-full">
              <TabsList className="grid grid-cols-3 md:grid-cols-5 mb-4">
                {PROVIDERS.map(provider => (
                  <TabsTrigger 
                    key={provider.value} 
                    value={provider.value}
                  >
                    {provider.label}
                  </TabsTrigger>
                ))}
              </TabsList>

              {/* Africa's Talking */}
              <TabsContent value="africastalking" className="space-y-4 p-4 border rounded-lg">
                <h3 className="text-lg font-semibold flex items-center gap-2">
                  <img
                    src={getProviderInfo('africastalking').logo}
                    alt="Africa's Talking"
                    className="w-5 h-5"
                  />
                  Africa's Talking Configuration
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="username" className="text-sm font-medium">Username <span className="text-red-500">*</span></Label>
                    <Controller
                      name="username"
                      control={control}
                      render={({ field }) => (
                        <Input
                          id="username"
                          {...field}
                          placeholder="Username"
                          className="w-full"
                          required={provider === 'africastalking'}
                        />
                      )}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="apiKey" className="text-sm font-medium">API Key <span className="text-red-500">*</span></Label>
                    <Controller
                      name="apiKey"
                      control={control}
                      render={({ field }) => (
                        <PasswordInput
                          id="apiKey"
                          field={field}
                          placeholder="API Key"
                          className="w-full"
                          required={provider === 'africastalking' || provider === 'textsms' || provider === 'vonage'}
                        />
                      )}
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="senderId" className="text-sm font-medium">Sender ID</Label>
                  <Controller
                    name="senderId"
                    control={control}
                    render={({ field }) => (
                      <Input
                        id="senderId"
                        {...field}
                        placeholder="Your registered sender ID or name"
                        className="w-full"
                      />
                    )}
                  />
                  <p className="text-xs text-muted-foreground">
                    This is the sender ID that will appear on recipients' phones.
                  </p>
                </div>
              </TabsContent>

              {/* Twilio */}
              <TabsContent value="twilio" className="space-y-4 p-4 border rounded-lg">
                <h3 className="text-lg font-semibold flex items-center gap-2">
                  <img
                    src={getProviderInfo('twilio').logo}
                    alt="Twilio"
                    className="w-5 h-5"
                  />
                  Twilio Configuration
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="accountSid" className="text-sm font-medium">Account SID <span className="text-red-500">*</span></Label>
                    <Controller
                      name="accountSid"
                      control={control}
                      render={({ field }) => (
                        <Input
                          id="accountSid"
                          {...field}
                          placeholder="Account SID"
                          className="w-full"
                          required={provider === 'twilio'}
                        />
                      )}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="authToken" className="text-sm font-medium">Auth Token <span className="text-red-500">*</span></Label>
                    <Controller
                      name="authToken"
                      control={control}
                      render={({ field }) => (
                        <PasswordInput
                          id="authToken"
                          field={field}
                          placeholder="Auth Token"
                          className="w-full"
                          required={provider === 'twilio'}
                        />
                      )}
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="senderId" className="text-sm font-medium">Sender ID/Phone Number</Label>
                  <Controller
                    name="senderId"
                    control={control}
                    render={({ field }) => (
                      <Input
                        id="senderId"
                        {...field}
                        placeholder="Your Twilio phone number (e.g., +12345678901)"
                        className="w-full"
                      />
                    )}
                  />
                  <p className="text-xs text-muted-foreground">
                    This must be a valid Twilio phone number purchased in your account.
                  </p>
                </div>
              </TabsContent>

              {/* Vonage */}
              <TabsContent value="vonage" className="space-y-4 p-4 border rounded-lg">
                <h3 className="text-lg font-semibold flex items-center gap-2">
                  <img
                    src={getProviderInfo('vonage').logo}
                    alt="Vonage"
                    className="w-5 h-5"
                  />
                  Vonage Configuration
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="apiKey" className="text-sm font-medium">API Key <span className="text-red-500">*</span></Label>
                    <Controller
                      name="apiKey"
                      control={control}
                      render={({ field }) => (
                        <PasswordInput
                          id="apiKey"
                          field={field}
                          placeholder="API Key"
                          className="w-full"
                          required={provider === 'vonage'}
                        />
                      )}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="apiSecret" className="text-sm font-medium">API Secret <span className="text-red-500">*</span></Label>
                    <Controller
                      name="apiSecret"
                      control={control}
                      render={({ field }) => (
                        <PasswordInput
                          id="apiSecret"
                          field={field}
                          placeholder="API Secret"
                          className="w-full"
                          required={provider === 'vonage'}
                        />
                      )}
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="senderId" className="text-sm font-medium">Sender ID</Label>
                  <Controller
                    name="senderId"
                    control={control}
                    render={({ field }) => (
                      <Input
                        id="senderId"
                        {...field}
                        placeholder="Your registered sender ID or name"
                        className="w-full"
                      />
                    )}
                  />
                  <p className="text-xs text-muted-foreground">
                    This is the sender ID that will appear on recipients' phones.
                  </p>
                </div>
              </TabsContent>

              {/* TextSMS */}
              <TabsContent value="textsms" className="space-y-4 p-4 border rounded-lg">
                <h3 className="text-lg font-semibold flex items-center gap-2">
                  <img
                    src={getProviderInfo('textsms').logo}
                    alt="TextSMS"
                    className="w-5 h-5"
                  />
                  TextSMS Configuration
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="partnerID" className="text-sm font-medium">Partner ID <span className="text-red-500">*</span></Label>
                    <Controller
                      name="partnerID"
                      control={control}
                      render={({ field }) => (
                        <Input
                          id="partnerID"
                          {...field}
                          placeholder="Partner ID"
                          className="w-full"
                          required={provider === 'textsms'}
                        />
                      )}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="apiKey" className="text-sm font-medium">API Key <span className="text-red-500">*</span></Label>
                    <Controller
                      name="apiKey"
                      control={control}
                      render={({ field }) => (
                        <PasswordInput
                          id="apiKey"
                          field={field}
                          placeholder="API Key"
                          className="w-full"
                          required={provider === 'textsms'}
                        />
                      )}
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="senderId" className="text-sm font-medium">Sender ID/Shortcode</Label>
                  <Controller
                    name="senderId"
                    control={control}
                    render={({ field }) => (
                      <Input
                        id="senderId"
                        {...field}
                        placeholder="Your registered shortcode"
                        className="w-full"
                      />
                    )}
                  />
                  <p className="text-xs text-muted-foreground">
                    This is the shortcode that will appear as the sender when recipients receive messages.
                  </p>
                </div>
              </TabsContent>

              {/* Zettatel */}
              <TabsContent value="zettatel" className="space-y-4 p-4 border rounded-lg">
                <h3 className="text-lg font-semibold flex items-center gap-2">
                  <img
                    src={getProviderInfo('zettatel').logo}
                    alt="Zettatel"
                    className="w-5 h-5"
                  />
                  Zettatel Configuration
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="username" className="text-sm font-medium">User ID <span className="text-red-500">*</span></Label>
                    <Controller
                      name="username"
                      control={control}
                      render={({ field }) => (
                        <Input
                          id="username"
                          {...field}
                          placeholder="Username"
                          className="w-full"
                          required={provider === 'zettatel'}
                        />
                      )}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="password" className="text-sm font-medium">Password <span className="text-red-500">*</span></Label>
                    <Controller
                      name="password"
                      control={control}
                      render={({ field }) => (
                        <PasswordInput
                          id="password"
                          field={field}
                          placeholder="Password"
                          className="w-full"
                          required={provider === 'zettatel'}
                        />
                      )}
                    />
                  </div>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="apiKey" className="text-sm font-medium">API Key</Label>
                    <Controller
                      name="apiKey"
                      control={control}
                      render={({ field }) => (
                        <PasswordInput
                          id="apiKey"
                          field={field}
                          placeholder="API Key (Optional)"
                          className="w-full"
                        />
                      )}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="msgType" className="text-sm font-medium">Message Type <span className="text-red-500">*</span></Label>
                    <Controller
                      name="msgType"
                      control={control}
                      render={({ field }) => (
                        <Select
                          value={field.value}
                          onValueChange={field.onChange}
                        >
                          <SelectTrigger id="msgType">
                            <SelectValue placeholder="Select message type" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="text">Text (English)</SelectItem>
                            <SelectItem value="unicode">Unicode (Regional)</SelectItem>
                          </SelectContent>
                        </Select>
                      )}
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="senderId" className="text-sm font-medium">Sender ID <span className="text-red-500">*</span></Label>
                  <Controller
                    name="senderId"
                    control={control}
                    render={({ field }) => (
                      <Input
                        id="senderId"
                        {...field}
                        placeholder="Your registered and approved sender ID"
                        className="w-full"
                        required={provider === 'zettatel'}
                      />
                    )}
                  />
                </div>
              </TabsContent>
            </Tabs>

            <Separator className="my-4" />

            <div className="space-y-2 bg-muted/30 p-4 rounded-lg">
              <div className="flex items-start gap-2">
                <Info className="h-5 w-5 text-blue-500 mt-0.5" />
                <div>
                  <Label htmlFor="callbackUrl" className="text-sm font-medium">Callback URL (Read Only)</Label>
                  <Input
                    id="callbackUrl"
                    value={config?.callbackUrl || ''}
                    placeholder="Callback URL generated by server"
                    disabled
                    className="bg-gray-50 mt-1"
                  />
                  <p className="text-xs text-muted-foreground mt-1">
                    This URL is automatically generated by the server and should be used in your SMS provider settings for delivery reports.
                  </p>
                </div>
              </div>
            </div>
          </CardContent>
          <CardFooter className="flex justify-between mt-4">
            <Button 
              type="button" 
              variant="outline" 
              onClick={onConfigUpdated}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={loading}>
              {loading ? 'Saving...' : 'Save Configuration'}
            </Button>
          </CardFooter>
        </form>
      </Card>
    </motion.div>
  );
};

export default SmsConfigForm;



