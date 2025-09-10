import { Organization } from '@/types/organization';

export type PaymentMethod = 'MPESA' | 'KOPOKOPO';

export interface PaymentMethodConfig {
  method: PaymentMethod;
  isActive: boolean;
  displayName: string;
  description: string;
  isConfigured: boolean;
}

/**
 * Get the currently active payment method for an organization
 */
export function getActivePaymentMethod(organization: Organization): PaymentMethodConfig | null {
  const activeMethod = organization.paymentMethod;
  
  if (!activeMethod) {
    return null;
  }

  switch (activeMethod) {
    case 'MPESA':
      return {
        method: 'MPESA',
        isActive: organization.mpesaConfig?.isActive || false,
        displayName: 'M-Pesa',
        description: 'Mobile money payments via Safaricom',
        isConfigured: !!organization.mpesaConfig
      };
    case 'KOPOKOPO':
      return {
        method: 'KOPOKOPO',
        isActive: organization.kopokopoConfig?.isActive || false,
        displayName: 'KopoKopo',
        description: 'Digital payments and transfers',
        isConfigured: !!organization.kopokopoConfig
      };
    default:
      return null;
  }
}

/**
 * Get all available payment methods for an organization (configured or not)
 */
export function getAvailablePaymentMethods(organization: Organization): PaymentMethodConfig[] {
  const methods: PaymentMethodConfig[] = [];

  // Check M-Pesa
  methods.push({
    method: 'MPESA',
    isActive: organization.mpesaConfig?.isActive || false,
    displayName: 'M-Pesa',
    description: 'Mobile money payments via Safaricom',
    isConfigured: !!organization.mpesaConfig
  });

  // Check KopoKopo
  methods.push({
    method: 'KOPOKOPO',
    isActive: organization.kopokopoConfig?.isActive || false,
    displayName: 'KopoKopo',
    description: 'Digital payments and transfers',
    isConfigured: !!organization.kopokopoConfig
  });

  return methods;
}

/**
 * Get configured payment methods (regardless of active status)
 */
export function getConfiguredPaymentMethods(organization: Organization): PaymentMethodConfig[] {
  return getAvailablePaymentMethods(organization).filter(method => method.isConfigured);
}

/**
 * Check if a specific payment method is the active one
 */
export function isPaymentMethodActive(organization: Organization, method: PaymentMethod): boolean {
  return organization.paymentMethod === method;
}

/**
 * Check if a specific payment method is configured
 */
export function isPaymentMethodConfigured(organization: Organization, method: PaymentMethod): boolean {
  switch (method) {
    case 'MPESA':
      return !!organization.mpesaConfig;
    case 'KOPOKOPO':
      return !!organization.kopokopoConfig;
    default:
      return false;
  }
}

/**
 * Get payment method configuration for display
 */
export function getPaymentMethodDisplayInfo(method: PaymentMethod) {
  switch (method) {
    case 'MPESA':
      return {
        name: 'M-Pesa',
        icon: '📱',
        color: 'green',
        bgColor: 'bg-green-50',
        borderColor: 'border-green-200'
      };
    case 'KOPOKOPO':
      return {
        name: 'KopoKopo',
        icon: '💳',
        color: 'blue',
        bgColor: 'bg-blue-50',
        borderColor: 'border-blue-200'
      };
    default:
      return {
        name: 'Unknown',
        icon: '❓',
        color: 'gray',
        bgColor: 'bg-gray-50',
        borderColor: 'border-gray-200'
      };
  }
}

/**
 * Get the status of a payment method
 */
export function getPaymentMethodStatus(organization: Organization, method: PaymentMethod): 'active' | 'configured' | 'not-configured' {
  if (isPaymentMethodActive(organization, method)) {
    return 'active';
  } else if (isPaymentMethodConfigured(organization, method)) {
    return 'configured';
  } else {
    return 'not-configured';
  }
}

/**
 * Check if organization has any payment method configured
 */
export function hasAnyPaymentMethodConfigured(organization: Organization): boolean {
  return getConfiguredPaymentMethods(organization).length > 0;
}

/**
 * Check if organization has an active payment method
 */
export function hasActivePaymentMethod(organization: Organization): boolean {
  return !!organization.paymentMethod;
}
