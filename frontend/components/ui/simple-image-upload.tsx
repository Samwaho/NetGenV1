"use client";

import { useState, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Upload, X, Image as ImageIcon, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { UPLOADCARE_CONFIG } from "@/lib/uploadcare-config";
import Image from "next/image";

interface SimpleImageUploadProps {
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

export const SimpleImageUpload = ({
  value,
  onChange,
  onRemove,
  disabled = false,
  label = "Image",
  placeholder = "Upload an image",
  className,
  showPreview = true,
  maxSize = 10,
  acceptedTypes = ["image/*"]
}: SimpleImageUploadProps) => {
  const [isUploading, setIsUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    // Validate file size
    if (file.size > maxSize * 1024 * 1024) {
      setError(`File size must be less than ${maxSize}MB`);
      return;
    }

    // Validate file type
    if (!acceptedTypes.some(type => {
      if (type === "image/*") return file.type.startsWith("image/");
      return file.type === type;
    })) {
      setError("Please select a valid image file");
      return;
    }

    setError(null);
    setIsUploading(true);

    try {
      // Upload to Uploadcare
      const formData = new FormData();
      formData.append('file', file);
      formData.append('UPLOADCARE_PUB_KEY', UPLOADCARE_CONFIG.PUBLIC_KEY);
      formData.append('UPLOADCARE_STORE', '1');

      const response = await fetch('https://upload.uploadcare.com/base/', {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        throw new Error('Upload failed');
      }

      const result = await response.json();
      const cdnUrl = `https://ucarecdn.com/${result.file}/`;
      
      onChange(cdnUrl);
      setIsUploading(false);
    } catch (err) {
      setError("Failed to upload image to Uploadcare");
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
    if (!disabled && !isUploading) {
      fileInputRef.current?.click();
    }
  };

  return (
    <div className={cn("space-y-4", className)}>
      {label && (
        <Label className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">
          {label}
        </Label>
      )}
      
      <div className="space-y-4">
        {/* File Input */}
        <Input
          ref={fileInputRef}
          type="file"
          accept={acceptedTypes.join(",")}
          onChange={handleFileSelect}
          className="hidden"
          disabled={disabled || isUploading}
        />
        
        {/* Upload Button */}
        <div className="flex items-center gap-4">
          <Button
            type="button"
            variant="outline"
            onClick={handleClick}
            disabled={disabled || isUploading}
            className="flex items-center gap-2"
          >
            {isUploading ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
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
          <div className="space-y-2">
            <Label className="text-sm text-muted-foreground">Preview</Label>
            <div className="relative">
              <div className="relative w-32 h-32 rounded-lg border border-border overflow-hidden">
                <Image
                  src={value}
                  alt="Preview"
                  width={128}
                  height={128}
                  className="w-full h-full object-cover"
                />
              </div>
            </div>
          </div>
        )}


      </div>
    </div>
  );
}; 