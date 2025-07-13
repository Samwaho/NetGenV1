"""
Default SMS templates for new organizations.
These templates will be automatically created when a new organization is set up.
"""
from typing import List, Dict, Any
from app.schemas.sms_template import TemplateCategory

DEFAULT_SMS_TEMPLATES: List[Dict[str, Any]] = [
    {
        "name": "Welcome Message",
        "content": "Hello {{firstName}}, welcome to {{organizationName}}! Your account was created successfully. Your Account Number is {{username}}. For support, contact us at {{orgPhone}} or visit {{orgWebsite}}.",
        "category": TemplateCategory.CUSTOMER_ONBOARDING.value,
        "description": "Sent to customers when they first sign up",
        "variables": ["firstName", "organizationName", "username", "orgPhone", "orgWebsite"]
    },
    {
        "name": "Invoice Payment",
        "content": "Dear {{firstName}} {{lastName}}, you have an outstanding balance of {{amountDue}} on your account. Please make your payment using Paybill Number: {{paybillNumber}}, Account Number: {{username}} to continue enjoying our services. Due date: {{dueDate}}.",
        "category": TemplateCategory.INVOICE_PAYMENT.value,
        "description": "Reminder for upcoming subscription payments",
        "variables": ["firstName", "lastName", "amountDue", "paybillNumber", "username", "dueDate"]
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
        "content": "Thank you {{firstName}}! We've received your payment for Account Number {{username}}. Your subscription is now active until {{expirationDate}}. Thank you for choosing {{organizationName}}!",
        "category": TemplateCategory.PAYMENT_CONFIRMATION.value,
        "description": "Confirmation after customer makes a payment",
        "variables": ["firstName", "username", "expirationDate", "organizationName"]
    },
    {
        "name": "Service Outage Notification",
        "content": "Dear {{firstName}}, we're experiencing a service outage in your area. Our team is working to resolve it. We apologize for the inconvenience. For updates, contact us at {{orgPhone}}.",
        "category": TemplateCategory.SERVICE_OUTAGE.value,
        "description": "Notification about service disruptions",
        "variables": ["firstName", "orgPhone"]
    },
    {
        "name": "Service Restored",
        "content": "Good news {{firstName}}! The service outage in your area has been resolved. Thank you for your patience. Your service is now fully operational.",
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
        "content": "Dear {{firstName}}, our technical team will visit your location soon. Please ensure someone is available. For any questions, contact us at {{orgPhone}}.",
        "category": TemplateCategory.TECHNICAL_SUPPORT.value,
        "description": "Information about scheduled technical support visits",
        "variables": ["firstName", "orgPhone"]
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
        "content": "Season's Greetings from all of us at {{organizationName}}! We wish you and your family a wonderful holiday season and a prosperous New Year! Visit us at {{orgWebsite}} for special holiday offers.",
        "category": TemplateCategory.MARKETING.value,
        "description": "Holiday greetings for customers",
        "variables": ["organizationName", "orgWebsite"]
    },
    {
        "name": "Hotspot Voucher Purchase",
        "content": "Dear {{firstName}}, you have successfully purchased a hotspot voucher. Your voucher code is {{voucherCode}}. Please use this code to activate your hotspot. Thank you for choosing {{organizationName}}! For support, contact us at {{orgPhone}}.",
        "category": TemplateCategory.HOTSPOT_VOUCHER.value,
        "description": "Notification of hotspot voucher purchase",
        "variables": ["firstName", "voucherCode", "organizationName", "orgPhone"]
    },
    {
        "name": "Business Information",
        "content": "{{organizationName}} - {{orgLegalName}}. Located at {{orgAddress}}, {{orgCity}}, {{orgState}}. Contact: {{orgPhone}}, {{orgEmail}}. Visit us at {{orgWebsite}}.",
        "category": TemplateCategory.GENERAL_NOTIFICATION.value,
        "description": "Template showcasing organization business information",
        "variables": ["organizationName", "orgLegalName", "orgAddress", "orgCity", "orgState", "orgPhone", "orgEmail", "orgWebsite"]
    }
]