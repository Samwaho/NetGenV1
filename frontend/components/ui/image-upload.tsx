"use client";

import { useState, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Upload, X, Image as ImageIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { UPLOADCARE_CONFIG, validateFile, getCdnUrl } from "@/lib/uploadcare-config";

interface ImageUploadProps {
  value?: string;
  onChange: (value: string) => void;
  onRemove?: () => void;
  disabled?: boolean;
  label?: string;
  placeholder?: string;
  className?: string;
  showPreview?: boolean;
  maxSize?: number; // in MB
  acceptedTypes?: string[];
}

export const ImageUpload = ({
  value,
  onChange,
  onRemove,
  disabled = false,
  label = "Image",
  placeholder = "Upload an image",
  className,
  showPreview = true,
  maxSize = 10, // 10MB default
  acceptedTypes = ["image/*"]
}: ImageUploadProps) => {
  const [isUploading, setIsUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    // Validate file using helper function
    const validationError = validateFile(file, maxSize, acceptedTypes);
    if (validationError) {
      setError(validationError);
      return;
    }

    setError(null);
    setIsUploading(true);

    try {
      // For now, we'll use a simple approach with FileReader
      // In a real implementation, you'd upload to Uploadcare here
      const reader = new FileReader();
      reader.onload = (e) => {
        const result = e.target?.result as string;
        onChange(result);
        setIsUploading(false);
      };
      reader.readAsDataURL(file);
    } catch (err) {
      setError("Failed to upload image");
      setIsUploading(false);
    }
  };

  const handleRemove = () => {
    onChange("");
    if (onRemove) onRemove();
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const handleClick = () => {
    if (!disabled) {
      fileInputRef.current?.click();
    }
  };

  return (
    <div className={cn("space-y-2", className)}>
      {label && (
        <Label className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">
          {label}
        </Label>
      )}
      
      <div className="space-y-4">
        {/* File Input */}
        <div className="flex items-center gap-4">
          <Input
            ref={fileInputRef}
            type="file"
            accept={acceptedTypes.join(",")}
            onChange={handleFileSelect}
            className="hidden"
            disabled={disabled || isUploading}
          />
          
          <Button
            type="button"
            variant="outline"
            onClick={handleClick}
            disabled={disabled || isUploading}
            className="flex items-center gap-2"
          >
            {isUploading ? (
              <>
                <div className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
                Uploading...
              </>
            ) : (
              <>
                <Upload className="h-4 w-4" />
                {placeholder}
              </>
            )}
          </Button>

          {value && onRemove && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleRemove}
              disabled={disabled || isUploading}
              className="text-destructive hover:text-destructive"
            >
              <X className="h-4 w-4" />
            </Button>
          )}
        </div>

        {/* Error Message */}
        {error && (
          <p className="text-sm text-destructive">{error}</p>
        )}

        {/* Preview */}
        {showPreview && value && (
          <div className="relative">
            <div className="relative w-32 h-32 rounded-lg border border-border overflow-hidden">
              <img
                src={value}
                alt="Preview"
                className="w-full h-full object-cover"
              />
            </div>
          </div>
        )}

        {/* URL Input for manual entry */}
        <div className="space-y-2">
          <Label className="text-sm text-muted-foreground">
            Or enter image URL
          </Label>
          <Input
            placeholder="https://example.com/image.jpg"
            value={value || ""}
            onChange={(e) => onChange(e.target.value)}
            disabled={disabled}
          />
        </div>
      </div>
    </div>
  );
};

// Uploadcare-specific component (for when you have Uploadcare credentials)
interface UploadcareImageUploadProps extends Omit<ImageUploadProps, 'onChange'> {
  onChange: (value: string) => void;
  publicKey?: string;
}

export const UploadcareImageUpload = ({
  value,
  onChange,
  publicKey,
  ...props
}: UploadcareImageUploadProps) => {
  const [widget, setWidget] = useState<any>(null);

  useEffect(() => {
    // Load Uploadcare widget script
    const script = document.createElement('script');
    script.src = 'https://ucarecdn.com/libs/widget/3.x/uploadcare.full.min.js';
    script.async = true;
    script.onload = () => {
      if (window.UploadcareWidget) {
        const widgetInstance = window.UploadcareWidget.createWidget('[data-uploadcare]', {
          publicKey: publicKey || UPLOADCARE_CONFIG.PUBLIC_KEY,
          ...UPLOADCARE_CONFIG.WIDGET_CONFIG,
        });

        widgetInstance.onChange((file: any) => {
          if (file) {
            file.done((info: any) => {
              onChange(info.cdnUrl);
            });
          } else {
            onChange('');
          }
        });

        setWidget(widgetInstance);
      }
    };
    document.head.appendChild(script);

    return () => {
      document.head.removeChild(script);
    };
  }, [publicKey, onChange]);

  return (
    <div className="space-y-2">
      {props.label && (
        <Label className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">
          {props.label}
        </Label>
      )}
      
      <div className="space-y-4">
        <input
          type="hidden"
          data-uploadcare
          value={value || ''}
          onChange={() => {}} // Handled by widget
        />
        
        {props.showPreview && value && (
          <div className="relative">
            <div className="relative w-32 h-32 rounded-lg border border-border overflow-hidden">
              <img
                src={value}
                alt="Preview"
                className="w-full h-full object-cover"
              />
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

// Add UploadcareWidget to window type
declare global {
  interface Window {
    UploadcareWidget: any;
  }
} 