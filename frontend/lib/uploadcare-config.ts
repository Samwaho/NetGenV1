// Uploadcare configuration
export const UPLOADCARE_CONFIG = {
  // Replace with your actual Uploadcare public key
  PUBLIC_KEY: process.env.NEXT_PUBLIC_UPLOADCARE_PUBLIC_KEY || 'demopublickey',
  
  // Widget configuration
  WIDGET_CONFIG: {
    imagesOnly: true,
    imagePreviewMaxSize: 10 * 1024 * 1024, // 10MB
    imageShrink: '1024x1024',
    multiple: false,
    locale: 'en',
    preferredTypes: ['image/*'],
    systemDialog: true,
    secureSignature: process.env.NEXT_PUBLIC_UPLOADCARE_SECURE_SIGNATURE,
    secureExpire: process.env.NEXT_PUBLIC_UPLOADCARE_SECURE_EXPIRE,
  },
  
  // File size limits (in MB)
  SIZE_LIMITS: {
    LOGO: 5,
    BANNER: 10,
    AVATAR: 2,
    GENERAL: 10,
  },
  
  // Accepted file types
  ACCEPTED_TYPES: {
    IMAGES: ['image/jpeg', 'image/png', 'image/gif', 'image/webp'],
    LOGO: ['image/png', 'image/svg+xml', 'image/jpeg'],
    BANNER: ['image/jpeg', 'image/png', 'image/webp'],
  },
  
  // CDN transformations
  CDN_TRANSFORMATIONS: {
    LOGO: {
      width: 200,
      height: 200,
      crop: 'center',
      format: 'auto',
    },
    BANNER: {
      width: 1200,
      height: 400,
      crop: 'center',
      format: 'auto',
    },
    THUMBNAIL: {
      width: 150,
      height: 150,
      crop: 'center',
      format: 'auto',
    },
  },
};

// Helper function to get CDN URL with transformations
export const getCdnUrl = (fileUrl: string, transformation?: keyof typeof UPLOADCARE_CONFIG.CDN_TRANSFORMATIONS): string => {
  if (!fileUrl || !fileUrl.includes('ucarecdn.com')) {
    return fileUrl;
  }
  
  if (!transformation) {
    return fileUrl;
  }
  
  const config = UPLOADCARE_CONFIG.CDN_TRANSFORMATIONS[transformation];
  const params = new URLSearchParams();
  
  if (config.width) params.append('w', config.width.toString());
  if (config.height) params.append('h', config.height.toString());
  if (config.crop) params.append('c', config.crop);
  if (config.format) params.append('f', config.format);
  
  const separator = fileUrl.includes('?') ? '&' : '?';
  return `${fileUrl}${separator}${params.toString()}`;
};

// Helper function to validate file
export const validateFile = (file: File, maxSize: number, acceptedTypes: string[]): string | null => {
  // Check file size
  if (file.size > maxSize * 1024 * 1024) {
    return `File size must be less than ${maxSize}MB`;
  }
  
  // Check file type
  if (!acceptedTypes.some(type => {
    if (type === 'image/*') return file.type.startsWith('image/');
    return file.type === type;
  })) {
    return 'Please select a valid image file';
  }
  
  return null;
}; 