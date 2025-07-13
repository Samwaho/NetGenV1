# Uploadcare Setup Guide

This guide will help you set up Uploadcare for image uploads in your organization forms.

## 1. Get Uploadcare Credentials

1. Sign up for a free account at [Uploadcare](https://uploadcare.com/)
2. Go to your [Uploadcare Dashboard](https://uploadcare.com/dashboard/)
3. Copy your **Public Key** from the API Keys section

## 2. Environment Variables

Create a `.env.local` file in your `frontend` directory and add:

```env
# Uploadcare Configuration
NEXT_PUBLIC_UPLOADCARE_PUBLIC_KEY=your_public_key_here

# Optional: For secure uploads (recommended for production)
NEXT_PUBLIC_UPLOADCARE_SECURE_SIGNATURE=your_secure_signature_here
NEXT_PUBLIC_UPLOADCARE_SECURE_EXPIRE=your_secure_expire_here
```

## 3. Features

The image upload component includes:

- **File Validation**: Size and type validation
- **Preview**: Real-time image preview
- **Multiple Upload Methods**: File picker and URL input
- **CDN Transformations**: Automatic image optimization
- **Error Handling**: User-friendly error messages

## 4. Usage

The image upload component is already integrated into:

- **Organization Creation Form**: Logo and banner uploads
- **Organization Details Tab**: Logo and banner editing

## 5. Configuration

You can customize the upload behavior in `lib/uploadcare-config.ts`:

- File size limits
- Accepted file types
- CDN transformations
- Widget settings

## 6. Security (Optional)

For production, enable secure uploads:

1. In your Uploadcare dashboard, go to Settings > Security
2. Enable "Secure uploads"
3. Copy the signature and expire values to your environment variables

## 7. Testing

The component works with the demo key for testing. For production, make sure to:

1. Use your actual Uploadcare public key
2. Enable secure uploads
3. Set appropriate file size limits
4. Configure CDN transformations as needed

## 8. Troubleshooting

- **Upload fails**: Check your public key and network connection
- **File too large**: Adjust the `maxSize` prop or configuration
- **Invalid file type**: Check the `acceptedTypes` configuration
- **Preview not showing**: Ensure the image URL is accessible 