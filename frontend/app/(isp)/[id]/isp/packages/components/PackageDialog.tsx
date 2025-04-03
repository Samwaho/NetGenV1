"use client";

import { useState } from "react";
import { useMutation } from "@apollo/client";
import { CREATE_ISP_PACKAGE, UPDATE_ISP_PACKAGE } from "@/graphql/isp_packages";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { ISPPackage } from "@/types/isp_package";
import { Textarea } from "@/components/ui/textarea";

interface PackageDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  organizationId: string;
  packageToEdit?: ISPPackage;
}

export function PackageDialog({ open, onOpenChange, organizationId, packageToEdit }: PackageDialogProps) {
  const [formData, setFormData] = useState({
    name: packageToEdit?.name || "",
    description: packageToEdit?.description || "",
    serviceType: packageToEdit?.serviceType || "FIBER",
    downloadSpeed: packageToEdit?.downloadSpeed?.toString() || "",
    uploadSpeed: packageToEdit?.uploadSpeed?.toString() || "",
    burstDownload: packageToEdit?.burstDownload?.toString() || "",
    burstUpload: packageToEdit?.burstUpload?.toString() || "",
    thresholdDownload: packageToEdit?.thresholdDownload?.toString() || "",
    thresholdUpload: packageToEdit?.thresholdUpload?.toString() || "",
    burstTime: packageToEdit?.burstTime?.toString() || "",
    addressPool: packageToEdit?.addressPool || "",
    price: packageToEdit?.price?.toString() || "",
  });

  const [createPackage, { loading: createLoading }] = useMutation(CREATE_ISP_PACKAGE, {
    onCompleted: () => {
      toast.success("Package created successfully");
      onOpenChange(false);
    },
    onError: (error) => {
      toast.error(error.message);
    },
    refetchQueries: ["GetISPPackages"],
  });

  const [updatePackage, { loading: updateLoading }] = useMutation(UPDATE_ISP_PACKAGE, {
    onCompleted: () => {
      toast.success("Package updated successfully");
      onOpenChange(false);
    },
    onError: (error) => {
      toast.error(error.message);
    },
    refetchQueries: ["GetISPPackages"],
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    const baseInput = {
      name: formData.name,
      description: formData.description,
      serviceType: formData.serviceType,
      downloadSpeed: parseInt(formData.downloadSpeed) || 0,
      uploadSpeed: parseInt(formData.uploadSpeed) || 0,
      burstDownload: formData.burstDownload ? parseInt(formData.burstDownload) : undefined,
      burstUpload: formData.burstUpload ? parseInt(formData.burstUpload) : undefined,
      thresholdDownload: formData.thresholdDownload ? parseInt(formData.thresholdDownload) : undefined,
      thresholdUpload: formData.thresholdUpload ? parseInt(formData.thresholdUpload) : undefined,
      burstTime: formData.burstTime ? parseInt(formData.burstTime) : undefined,
      addressPool: formData.addressPool || undefined,
      price: parseFloat(formData.price) || 0,
    };

    if (packageToEdit) {
      await updatePackage({
        variables: {
          id: packageToEdit.id,
          input: baseInput,
        },
      });
    } else {
      await createPackage({ 
        variables: {
          input: {
            ...baseInput,
            organizationId,
          }
        }
      });
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>
            {packageToEdit ? "Edit Package" : "Create New Package"}
          </DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="name">Package Name</Label>
            <Input
              id="name"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              placeholder="Enter package name"
              required
            />
          </div>
          
          <div className="space-y-2">
            <Label htmlFor="description">Description</Label>
            <Textarea
              id="description"
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              placeholder="Enter package description"
              required
            />
          </div>
          
          <div className="space-y-2">
            <Label htmlFor="serviceType">Service Type</Label>
            <Select
              value={formData.serviceType}
              onValueChange={(value) => setFormData({ ...formData, serviceType: value })}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select service type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="PPPOE">PPPoE</SelectItem>
                <SelectItem value="HOTSPOT">Hotspot</SelectItem>
                <SelectItem value="STATIC">Static</SelectItem>
                <SelectItem value="DHCP">DHCP</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="downloadSpeed">Download Speed (Mbps)</Label>
              <Input
                id="downloadSpeed"
                type="number"
                value={formData.downloadSpeed}
                onChange={(e) => setFormData({ ...formData, downloadSpeed: e.target.value })}
                placeholder="Download speed"
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="uploadSpeed">Upload Speed (Mbps)</Label>
              <Input
                id="uploadSpeed"
                type="number"
                value={formData.uploadSpeed}
                onChange={(e) => setFormData({ ...formData, uploadSpeed: e.target.value })}
                placeholder="Upload speed"
                required
              />
            </div>
          </div>
          
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="burstDownload">Burst Download (Mbps)</Label>
              <Input
                id="burstDownload"
                type="number"
                value={formData.burstDownload}
                onChange={(e) => setFormData({ ...formData, burstDownload: e.target.value })}
                placeholder="Burst download"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="burstUpload">Burst Upload (Mbps)</Label>
              <Input
                id="burstUpload"
                type="number"
                value={formData.burstUpload}
                onChange={(e) => setFormData({ ...formData, burstUpload: e.target.value })}
                placeholder="Burst upload"
              />
            </div>
          </div>
          
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="thresholdDownload">Threshold Download (Mbps)</Label>
              <Input
                id="thresholdDownload"
                type="number"
                value={formData.thresholdDownload}
                onChange={(e) => setFormData({ ...formData, thresholdDownload: e.target.value })}
                placeholder="Threshold download"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="thresholdUpload">Threshold Upload (Mbps)</Label>
              <Input
                id="thresholdUpload"
                type="number"
                value={formData.thresholdUpload}
                onChange={(e) => setFormData({ ...formData, thresholdUpload: e.target.value })}
                placeholder="Threshold upload"
              />
            </div>
          </div>
          
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="burstTime">Burst Time (seconds)</Label>
              <Input
                id="burstTime"
                type="number"
                value={formData.burstTime}
                onChange={(e) => setFormData({ ...formData, burstTime: e.target.value })}
                placeholder="Burst time"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="addressPool">Address Pool</Label>
              <Input
                id="addressPool"
                value={formData.addressPool}
                onChange={(e) => setFormData({ ...formData, addressPool: e.target.value })}
                placeholder="Address pool"
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="price">Price ($)</Label>
            <Input
              id="price"
              type="number"
              step="0.01"
              value={formData.price}
              onChange={(e) => setFormData({ ...formData, price: e.target.value })}
              placeholder="Enter price"
              required
            />
          </div>

          <div className="flex justify-end space-x-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={createLoading || updateLoading}
              className="bg-gradient-custom text-white hover:text-white"
            >
              {createLoading || updateLoading
                ? "Saving..."
                : packageToEdit
                ? "Update Package"
                : "Create Package"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
