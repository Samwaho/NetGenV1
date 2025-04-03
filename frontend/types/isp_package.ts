export type ISPPackage = {
  id: string;
  name: string;
  description?: string;
  price: number;
  organization: {
    id: string;
    name: string;
  };
  downloadSpeed: number;
  uploadSpeed: number;
  burstDownload: number;
  burstUpload: number;
  thresholdDownload: number;
  thresholdUpload: number;
  burstTime: number;
  serviceType: 'PPPOE' | 'HOTSPOT' | 'STATIC' | 'DHCP';
  status: 'ACTIVE' | 'INACTIVE' | 'DRAFT';
  addressPool: string;
  createdAt: string;
  updatedAt: string;
};

export interface ISPPackagesResponse {
  packages: {
    success: boolean;
    message: string;
    packages: ISPPackage[];
  };
}

export interface ISPPackageResponse {
  package: {
    success: boolean;
    message: string;
    package: ISPPackage;
  };
}

export type CreateISPPackageInput = {
  name: string;
  description?: string;
  price: number;
  organizationId: string;
  downloadSpeed: number;
  uploadSpeed: number;
  burstDownload: number;
  burstUpload: number;
  thresholdDownload: number;
  thresholdUpload: number;
  burstTime: number;
  serviceType: string;
  addressPool: string;
};

export type UpdateISPPackageInput = Partial<CreateISPPackageInput>;

