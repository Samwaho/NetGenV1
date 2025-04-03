"use client";

import { useState } from "react";
import { useMutation, useQuery } from "@apollo/client";
import { CREATE_ISP_CUSTOMER } from "@/graphql/isp_customers";
import { GET_ISP_PACKAGES } from "@/graphql/isp_packages";
import { GET_ISP_STATIONS } from "@/graphql/isp_stations";
import { CreateISPCustomerInput } from "@/types/isp_customer";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { DateTimePicker } from "./DateTimePicker";

interface Package {
  id: string;
  name: string;
}

interface Station {
  id: string;
  name: string;
}

interface CustomerDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  organizationId: string;
}

export function CustomerDialog({
  open,
  onOpenChange,
  organizationId,
}: CustomerDialogProps) {
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(undefined);
  const [formData, setFormData] = useState<CreateISPCustomerInput>({
    firstName: "",
    lastName: "",
    email: "",
    phone: "",
    username: "",
    password: "",
    organizationId,
    packageId: "",
    stationId: "",
    expirationDate: "",
  });

  const { data: packagesData } = useQuery(GET_ISP_PACKAGES, {
    variables: { organizationId },
  });
  const { data: stationsData } = useQuery(GET_ISP_STATIONS, {
    variables: { organizationId },
  });

  const [createCustomer] = useMutation(CREATE_ISP_CUSTOMER);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedDate) {
      toast.error("Please select an expiration date");
      return;
    }
    try {
      const submissionData = {
        ...formData,
        expirationDate: selectedDate.toISOString(),
      };
      await createCustomer({
        variables: { input: submissionData },
      });
      toast.success("Customer created successfully");
      onOpenChange(false);
      // Reset form
      setFormData({
        firstName: "",
        lastName: "",
        email: "",
        phone: "",
        username: "",
        password: "",
        organizationId,
        packageId: "",
        stationId: "",
        expirationDate: "",
      });
      setSelectedDate(undefined);
    } catch (error) {
      console.error("Error creating customer:", error);
      toast.error("Failed to create customer");
    }
  };

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>
  ) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[600px]">
        <DialogHeader>
          <DialogTitle>Create New Customer</DialogTitle>
          <DialogDescription>
            Fill in the details to create a new customer account.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit}>
          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="firstName">First Name</Label>
                <Input
                  id="firstName"
                  name="firstName"
                  value={formData.firstName}
                  onChange={handleChange}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="lastName">Last Name</Label>
                <Input
                  id="lastName"
                  name="lastName"
                  value={formData.lastName}
                  onChange={handleChange}
                  required
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  name="email"
                  type="email"
                  value={formData.email}
                  onChange={handleChange}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="phone">Phone</Label>
                <Input
                  id="phone"
                  name="phone"
                  value={formData.phone}
                  onChange={handleChange}
                  required
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="username">Username</Label>
                <Input
                  id="username"
                  name="username"
                  value={formData.username}
                  onChange={handleChange}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="password">Password</Label>
                <Input
                  id="password"
                  name="password"
                  type="password"
                  value={formData.password}
                  onChange={handleChange}
                  required
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="packageId">Package</Label>
                <Select
                  name="packageId"
                  value={formData.packageId}
                  onValueChange={(value) =>
                    setFormData((prev) => ({ ...prev, packageId: value }))
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select a package" />
                  </SelectTrigger>
                  <SelectContent>
                    {packagesData?.packages.packages.map((pkg: Package) => (
                      <SelectItem key={pkg.id} value={pkg.id}>
                        {pkg.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="stationId">Station</Label>
                <Select
                  name="stationId"
                  value={formData.stationId}
                  onValueChange={(value) =>
                    setFormData((prev) => ({ ...prev, stationId: value }))
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select a station" />
                  </SelectTrigger>
                  <SelectContent>
                    {stationsData?.stations.stations.map((station: Station) => (
                      <SelectItem key={station.id} value={station.id}>
                        {station.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-2">
              <Label>Expiration Date & Time</Label>
              <div className="flex items-center gap-2">
                <DateTimePicker 
                  date={selectedDate} 
                  setDate={(newDate) => {
                    setSelectedDate(newDate);
                    if (newDate) {
                      setFormData(prev => ({
                        ...prev,
                        expirationDate: newDate.toISOString()
                      }));
                    }
                  }} 
                />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button type="submit">Create Customer</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
} 