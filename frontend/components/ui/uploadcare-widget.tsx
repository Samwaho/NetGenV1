"use client";

import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Upload, X, Image as ImageIcon, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { UPLOADCARE_CONFIG, getCdnUrl } from "@/lib/uploadcare-config";

interface UploadcareWidgetProps {
  value?: string;
  onChange: (value: string) => void;
  onRemove?: () => void;
  disabled?: boolean;
  label?: string;
  placeholder?: string;
  className?: string;
  showPreview?: boolean;
  maxSize?: number;
  acceptedTypes?: string[];
  publicKey?: string;
  transformation?: keyof typeof UPLOADCARE_CONFIG.CDN_TRANSFORMATIONS;
}

export const UploadcareWidget = ({
  value,
  onChange,
  onRemove,
  disabled = false,
  label = "Image",
  placeholder = "Upload an image",
  className,
  showPreview = true,
  maxSize = 10,
  acceptedTypes = ["image/*"],
  publicKey,
  transformation,
}: UploadcareWidgetProps) => {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [widget, setWidget] = useState<any>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const widgetRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // Load Uploadcare script
    const loadUploadcareScript = () => {
      return new Promise<void>((resolve, reject) => {
        if (window.UploadcareWidget) {
          resolve();
          return;
        }

        const script = document.createElement('script');
        script.src = 'https://ucarecdn.com/libs/widget/3.x/uploadcare.full.min.js';
        script.async = true;
        script.onload = () => resolve();
        script.onerror = () => reject(new Error('Failed to load Uploadcare script'));
        document.head.appendChild(script);
      });
    };

    const initializeWidget = async () => {
      try {
        await loadUploadcareScript();
        
        if (!widgetRef.current || !window.UploadcareWidget) return;

        // Create a hidden input for the widget
        const input = document.createElement('input');
        input.type = 'hidden';
        input.setAttribute('data-uploadcare', '');
        widgetRef.current.appendChild(input);

        const widgetInstance = window.UploadcareWidget.createWidget(input, {
          publicKey: publicKey || UPLOADCARE_CONFIG.PUBLIC_KEY,
          imagesOnly: true,
          imagePreviewMaxSize: maxSize * 1024 * 1024,
          preferredTypes: acceptedTypes,
          multiple: false,
          locale: 'en',
          systemDialog: true,
        });

        widgetInstance.onChange((file: any) => {
          setIsLoading(true);
          setError(null);
          
          if (file) {
            file.done((info: any) => {
              const cdnUrl = transformation 
                ? getCdnUrl(info.cdnUrl, transformation)
                : info.cdnUrl;
              onChange(cdnUrl);
              setIsLoading(false);
            }).fail(() => {
              setError('Upload failed. Please try again.');
              setIsLoading(false);
            });
          } else {
            onChange('');
            setIsLoading(false);
          }
        });

        setWidget(widgetInstance);
      } catch (err) {
        setError('Failed to initialize upload widget');
        console.error('Uploadcare widget error:', err);
      }
    };

    if (!disabled) {
      initializeWidget();
    }

    return () => {
      if (widget) {
        widget.destroy();
      }
    };
  }, [publicKey, maxSize, acceptedTypes, transformation, disabled, onChange]);

  const handleRemove = () => {
    if (widget) {
      widget.value(null);
    }
    onChange('');
    if (onRemove) onRemove();
  };

  const handleUrlInput = (url: string) => {
    onChange(url);
  };

  return (
    <div className={cn("space-y-4", className)}>
      {label && (
        <Label className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">
          {label}
        </Label>
      )}
      
      <div className="space-y-4">
        {/* Uploadcare Widget */}
        <div className="space-y-2">
          <div
            ref={widgetRef}
            className={cn(
              "border-2 border-dashed border-border rounded-lg p-4 transition-colors",
              disabled && "opacity-50 cursor-not-allowed",
              isLoading && "border-primary"
            )}
          >
            {isLoading ? (
              <div className="flex items-center justify-center gap-2 text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" />
                <span>Uploading...</span>
              </div>
            ) : (
              <div className="flex items-center justify-center gap-2 text-muted-foreground">
                <Upload className="h-4 w-4" />
                <span>{placeholder}</span>
              </div>
            )}
          </div>
        </div>

        {/* Error Message */}
        {error && (
          <p className="text-sm text-destructive">{error}</p>
        )}

        {/* Preview */}
        {showPreview && value && (
          <div className="space-y-2">
            <Label className="text-sm text-muted-foreground">Preview</Label>
            <div className="relative">
              <div className="relative w-32 h-32 rounded-lg border border-border overflow-hidden">
                <img
                  src={value}
                  alt="Preview"
                  className="w-full h-full object-cover"
                  onError={() => setError('Failed to load image preview')}
                />
              </div>
              {onRemove && (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={handleRemove}
                  disabled={disabled || isLoading}
                  className="absolute -top-2 -right-2 h-6 w-6 p-0 text-destructive hover:text-destructive"
                >
                  <X className="h-3 w-3" />
                </Button>
              )}
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
            onChange={(e) => handleUrlInput(e.target.value)}
            disabled={disabled || isLoading}
          />
        </div>
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