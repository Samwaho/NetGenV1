export type EquipmentCategory = 
  | 'ROUTER'
  | 'SWITCH'
  | 'ACCESS_POINT'
  | 'ANTENNA'
  | 'CABLE'
  | 'CONNECTOR'
  | 'POWER_SUPPLY'
  | 'SERVER'
  | 'CPE'
  | 'TOOLS'
  | 'OTHER';

export const EquipmentStatus = {
  AVAILABLE: 'AVAILABLE',
  IN_USE: 'IN_USE',
  DEFECTIVE: 'DEFECTIVE',
  IN_REPAIR: 'IN_REPAIR',
  RESERVED: 'RESERVED',
  DISPOSED: 'DISPOSED'
} as const;

export type EquipmentStatus = typeof EquipmentStatus[keyof typeof EquipmentStatus];

export type ISPInventory = {
  id: string;
  name: string;
  category: EquipmentCategory;
  organization: {
    id: string;
    name: string;
  };
  model?: string;
  manufacturer?: string;
  serialNumber?: string;
  macAddress?: string;
  ipAddress?: string;
  quantity: number;
  quantityThreshold?: number;
  unitPrice: number;
  status: EquipmentStatus;
  location?: string;
  assignedTo?: string;
  warrantyExpirationDate?: string;
  purchaseDate?: string;
  specifications?: string;
  notes?: string;
  createdAt: string;
  updatedAt: string;
};

export interface ISPInventoriesResponse {
  inventories: {
    success: boolean;
    message: string;
    inventories: ISPInventory[];
  };
}

export interface ISPInventoryResponse {
  inventory: {
    success: boolean;
    message: string;
    inventory: ISPInventory;
  };
}

export type CreateISPInventoryInput = {
  name: string;
  category: EquipmentCategory;
  organizationId: string;
  model?: string;
  manufacturer?: string;
  serialNumber?: string;
  macAddress?: string;
  ipAddress?: string;
  quantity: number;
  quantityThreshold?: number;
  unitPrice: number;
  location?: string;
  warrantyExpirationDate?: string;
  purchaseDate?: string;
  specifications?: string;
  notes?: string;
};

export type UpdateISPInventoryInput = Partial<CreateISPInventoryInput> & {
  status?: EquipmentStatus;
  assignedTo?: string;
};

