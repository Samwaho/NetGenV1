# KopoKopo Integration

This document describes the integration of KopoKopo as a payment method in the NetGenV1 system. The system now supports multiple payment methods with a **single active payment method per organization** approach.

## Overview

The payment system has been redesigned to support multiple payment gateways while ensuring each organization uses only one active payment method at a time. This provides:

- **Simplicity**: Clear, single payment method per organization
- **Flexibility**: Easy to switch between payment methods
- **Extensibility**: Simple to add new payment methods in the future
- **Consistency**: Uniform transaction handling across different payment methods

## Supported Payment Methods

Currently, the system supports:

1. **M-Pesa**: Mobile money payments via Safaricom
2. **KopoKopo**: Digital payments and transfers

## Architecture

### Organization Payment Configuration

Each organization has:
- `paymentMethod`: The currently active payment method (`MPESA` or `KOPOKOPO`)
- `mpesaConfig`: M-Pesa configuration (when applicable)
- `kopokopoConfig`: KopoKopo configuration (when applicable)

### Payment Method States

Each payment method can be in one of three states:

1. **Active**: Currently selected as the organization's payment method
2. **Configured**: Set up but not currently active
3. **Not Configured**: Not set up at all

## KopoKopo Features

### Authentication
- **Client Credentials Flow**: Secure OAuth2 authentication
- **Environment Support**: Sandbox and production environments
- **Token Management**: Automatic token refresh and caching

### Webhook Subscriptions
- **Buy Goods Transactions**: Real-time notifications for customer payments
- **B2B Transactions**: Business-to-business payment notifications
- **Settlement Transfers**: Transfer completion notifications
- **Customer Creation**: New customer registration notifications

### PAY (Send Money) Service
- **Recipient Management**: Create and manage pay recipients
- **Transfer Initiation**: Send money to recipients
- **Transaction Tracking**: Monitor transfer status and completion

### Transaction Types
- `KOPOKOPO_BUYGOODS`: Customer payments via buy goods
- `KOPOKOPO_B2B`: Business-to-business transactions
- `KOPOKOPO_SETTLEMENT`: Settlement transfers

## Setup Instructions

### 1. Backend Configuration

#### Environment Variables
```bash
# KopoKopo Configuration
KOPOKOPO_SANDBOX_CLIENT_ID=your_sandbox_client_id
KOPOKOPO_SANDBOX_CLIENT_SECRET=your_sandbox_client_secret
KOPOKOPO_PRODUCTION_CLIENT_ID=your_production_client_id
KOPOKOPO_PRODUCTION_CLIENT_SECRET=your_production_client_secret
```

#### Database Collections
The system uses the following MongoDB collections:
- `organizations`: Organization data with payment configurations
- `isp_kopokopo_transactions`: KopoKopo-specific transaction records

### 2. Organization Setup

#### Configure KopoKopo
1. Navigate to your organization settings
2. Go to the KopoKopo configuration section
3. Enter your KopoKopo credentials:
   - Client ID and Secret
   - Business name and till number
   - Webhook secret for signature validation
   - Environment (sandbox/production)
4. Save the configuration

#### Activate KopoKopo
1. After configuring KopoKopo, activate it as your payment method
2. The system will automatically:
   - Deactivate any other payment methods
   - Register webhook subscriptions with KopoKopo
   - Set KopoKopo as the active payment method

### 3. Frontend Integration

#### Payment Method Selection
Use the `PaymentMethodSelector` component to manage payment methods:

```tsx
import { PaymentMethodSelector } from '@/components/PaymentMethodSelector';

<PaymentMethodSelector
  organization={organization}
  onPaymentMethodChange={handlePaymentMethodChange}
  onConfigureMethod={handleConfigureMethod}
/>
```

#### Payment Utilities
Use the payment utilities to check payment method status:

```tsx
import { 
  getActivePaymentMethod, 
  isPaymentMethodActive,
  hasActivePaymentMethod 
} from '@/lib/payment-utils';

// Get the currently active payment method
const activeMethod = getActivePaymentMethod(organization);

// Check if a specific method is active
const isKopoKopoActive = isPaymentMethodActive(organization, 'KOPOKOPO');

// Check if organization has any active payment method
const hasPaymentMethod = hasActivePaymentMethod(organization);
```

## API Endpoints

### KopoKopo-Specific Endpoints

#### Webhook Callbacks
```
POST /api/payments/kopokopo/callback/{organization_id}/{callback_type}
```

Supported callback types:
- `buygoods`: Customer payment notifications
- `b2b`: Business-to-business notifications
- `settlement`: Settlement transfer notifications
- `customer`: Customer creation notifications

#### Payment Initiation
```
POST /api/payments/kopokopo/pay
```

#### Transaction Retrieval
```
GET /api/payments/kopokopo/transactions/{organization_id}
```

### Hotspot Integration
```
POST /api/hotspot/purchase-voucher-kopokopo
```

## GraphQL Schema

### Organization Type
```graphql
type Organization {
  id: ID!
  name: String!
  paymentMethod: PaymentMethodType
  mpesaConfig: MpesaConfiguration
  kopokopoConfig: KopoKopoConfiguration
  # ... other fields
}

enum PaymentMethodType {
  MPESA
  KOPOKOPO
}
```

### Mutations
```graphql
# Set the active payment method
mutation SetPaymentMethod($organizationId: ID!, $paymentMethod: PaymentMethodType!) {
  setPaymentMethod(organizationId: $organizationId, input: { paymentMethod: $paymentMethod }) {
    success
    message
    organization {
      id
      paymentMethod
    }
  }
}

# Update KopoKopo configuration
mutation UpdateKopoKopoConfig($organizationId: ID!, $input: KopoKopoConfigurationInput!) {
  updateKopoKopoConfiguration(organizationId: $organizationId, input: $input) {
    id
    kopokopoConfig {
      isActive
      environment
      businessName
    }
    paymentMethod
  }
}
```

## Transaction Processing

### Webhook Flow
1. **Receipt**: KopoKopo sends webhook to `/api/payments/kopokopo/callback/{org_id}/{type}`
2. **Validation**: System validates webhook signature and IP address
3. **Processing**: Transaction is processed based on callback type
4. **Storage**: Transaction details are stored in `isp_kopokopo_transactions`
5. **Business Logic**: System triggers appropriate business actions (voucher activation, etc.)

### Payment Flow
1. **Initiation**: Client calls payment initiation endpoint
2. **Recipient Creation**: System creates pay recipient in KopoKopo
3. **Transfer Request**: System initiates transfer to recipient
4. **Status Tracking**: System polls for transfer status
5. **Completion**: Webhook confirms successful transfer

## Error Handling

### KopoKopoErrorHandler
Standardized error messages for common KopoKopo API errors:
- Authentication failures
- Invalid credentials
- Network timeouts
- Webhook validation errors

### Validation
- **Input Validation**: All API inputs are validated
- **Webhook Signature**: HMAC-SHA256 signature validation
- **IP Whitelisting**: Optional IP address validation

## Security Considerations

### Webhook Security
- **Signature Validation**: All webhooks are validated using HMAC-SHA256
- **IP Whitelisting**: Optional IP address validation (configured per environment)
- **Organization Isolation**: Each organization's webhooks are isolated

### Data Protection
- **Encrypted Storage**: Sensitive credentials are encrypted
- **Access Control**: Payment method management requires specific permissions
- **Audit Logging**: All payment method changes are logged

## Testing

### Test Script
Use the provided test script to verify integration:

```bash
python test_kopokopo_integration.py
```

### Test Scenarios
1. **Configuration**: Test KopoKopo configuration setup
2. **Activation**: Test payment method activation
3. **Webhooks**: Test webhook callback processing
4. **Payments**: Test payment initiation and completion
5. **Error Handling**: Test various error scenarios

## Monitoring

### Logs
Monitor the following log entries:
- `KopoKopoService`: API interactions and responses
- `KopoKopoTransactionService`: Transaction processing
- `KopoKopoErrorHandler`: Error handling and recovery

### Metrics
Track key metrics:
- Webhook delivery success rate
- Payment completion rate
- API response times
- Error rates by type

## Troubleshooting

### Common Issues

#### Webhook Not Received
1. Check webhook URL configuration
2. Verify webhook secret
3. Check network connectivity
4. Review KopoKopo dashboard for webhook status

#### Payment Failures
1. Verify recipient creation
2. Check transfer status in KopoKopo dashboard
3. Review error logs for specific failure reasons
4. Validate organization configuration

#### Authentication Errors
1. Verify client credentials
2. Check environment configuration
3. Ensure token refresh is working
4. Review API rate limits

### Debug Mode
Enable debug logging for detailed troubleshooting:

```python
import logging
logging.getLogger('kopokopo').setLevel(logging.DEBUG)
```

## Migration from M-Pesa

### Step-by-Step Migration
1. **Configure KopoKopo**: Set up KopoKopo configuration
2. **Test Integration**: Verify KopoKopo functionality
3. **Switch Payment Method**: Activate KopoKopo as the payment method
4. **Monitor Transactions**: Ensure smooth transition
5. **Deactivate M-Pesa**: Optionally deactivate M-Pesa configuration

### Data Migration
- Existing M-Pesa transactions remain unchanged
- New transactions use KopoKopo
- Historical data is preserved for reporting

## Best Practices

### Configuration Management
- Use environment-specific credentials
- Regularly rotate webhook secrets
- Monitor configuration changes
- Document configuration decisions

### Error Handling
- Implement comprehensive error handling
- Log all errors with context
- Provide user-friendly error messages
- Implement retry mechanisms

### Security
- Validate all inputs
- Use HTTPS for all communications
- Implement proper access controls
- Regular security audits

### Performance
- Cache authentication tokens
- Implement connection pooling
- Monitor API response times
- Optimize database queries

## Future Enhancements

### Planned Features
- **Additional Payment Methods**: Support for more payment gateways
- **Payment Method Comparison**: Tools to compare payment method performance
- **Advanced Analytics**: Detailed payment method analytics
- **Automated Switching**: Smart payment method selection

### Extensibility
The system is designed to easily add new payment methods:
1. Add new payment method type to enum
2. Create configuration schema
3. Implement service class
4. Add GraphQL resolvers
5. Update frontend components

## Support

For technical support:
1. Check the troubleshooting section
2. Review error logs
3. Test with the provided test script
4. Contact the development team

## Changelog

### Version 1.0.0
- Initial KopoKopo integration
- Single payment method per organization
- Webhook support for all transaction types
- PAY service integration
- Comprehensive error handling
- Frontend payment method selector
- Test suite and documentation
