"""
Default SMS templates for new organizations.
These templates will be automatically created when a new organization is set up.
"""
from typing import List, Dict, Any
from app.schemas.sms_template import TemplateCategory

DEFAULT_SMS_TEMPLATES: List[Dict[str, Any]] = [
    {
        "name": "Welcome Message",
        "content": "Hello {{firstName}}, welcome to {{organizationName}}! Your account was created successfully. Your Account Number  is {{username}}. For support, contact us at our helpline.",
        "category": TemplateCategory.CUSTOMER_ONBOARDING.value,
        "description": "Sent to customers when they first sign up",
        "variables": ["firstName", "organizationName", "username"]
    },
    {
        "name": "Invoice Payment",
        "content": "Dear {{firstName}} {{lastName}}, you have an outstanding balance of {{amountDue}} on your account. Please make your payment using  Paybill Number: {{paybillNumber}}, Account Number: {{username}} to continue enjoying our services.",
        "category": TemplateCategory.INVOICE_PAYMENT.value,
        "description": "Reminder for upcoming subscription payments",
        "variables": ["firstName", "lastName", "amountDue", "paybillNumber", "username"]
    },
    {
        "name": "Payment Reminder",
        "content": "Dear {{firstName}} {{lastName}}, your internet subscription will expire in {{daysToExpire}} days. Please make your payment before {{expirationDate}} to continue enjoying our services.",
        "category": TemplateCategory.PAYMENT_REMINDER.value,
        "description": "Reminder for upcoming subscription payments",
        "variables": ["firstName", "lastName", "daysToExpire", "expirationDate"]
    },
    {
        "name": "Payment Confirmation",
        "content": "Thank you {{firstName}}! We've received your payment for Account Number {{username}}. Your subscription is now active until {{expirationDate}}.",
        "category": TemplateCategory.PAYMENT_CONFIRMATION.value,
        "description": "Confirmation after customer makes a payment",
        "variables": ["firstName", "username", "expirationDate"]
    },
    {
        "name": "Service Outage Notification",
        "content": "Dear {{firstName}}, we're experiencing a service outage in your area. Our team is working to resolve it. We apologize for the inconvenience.",
        "category": TemplateCategory.SERVICE_OUTAGE.value,
        "description": "Notification about service disruptions",
        "variables": ["firstName"]
    },
    {
        "name": "Service Restored",
        "content": "Good news {{firstName}}! The service outage in your area has been resolved. Thank you for your patience.",
        "category": TemplateCategory.SERVICE_OUTAGE.value,
        "description": "Notification when service is restored after an outage",
        "variables": ["firstName"]
    },
    {
        "name": "Package Upgrade Offer",
        "content": "{{firstName}}, upgrade to our premium package and enjoy faster download speeds! Contact us for details.",
        "category": TemplateCategory.PLAN_UPGRADE.value,
        "description": "Promotional offer for package upgrades",
        "variables": ["firstName"]
    },
    {
        "name": "Technical Support",
        "content": "Dear {{firstName}}, our technical team will visit your location soon. Please ensure someone is available.",
        "category": TemplateCategory.TECHNICAL_SUPPORT.value,
        "description": "Information about scheduled technical support visits",
        "variables": ["firstName"]
    },
    {
        "name": "Monthly Usage Summary",
        "content": "{{firstName}}, your monthly usage summary: Your current package is {{packageName}}.",
        "category": TemplateCategory.GENERAL_NOTIFICATION.value,
        "description": "Monthly summary of customer's data usage",
        "variables": ["firstName", "packageName"]
    },
    {
        "name": "Holiday Greetings",
        "content": "Season's Greetings from all of us! We wish you and your family a wonderful holiday season and a prosperous New Year!",
        "category": TemplateCategory.MARKETING.value,
        "description": "Holiday greetings for customers",
        "variables": []
    }
]