import { Organization } from './organization';

export type StationStatus = 'ACTIVE' | 'INACTIVE' | 'MAINTENANCE' | 'OFFLINE';

export type BuildingType = 'RESIDENTIAL' | 'COMMERCIAL' | 'INDUSTRIAL' | 'GOVERNMENT' | 'EDUCATIONAL' | 'OTHER';

export interface ISPStation {
  id: string;
  name: string;
  description?: string;
  organization: Organization;
  location: string;
  buildingType: BuildingType;
  notes?: string;
  status: StationStatus;
  coordinates?: string;
  createdAt: string;
  updatedAt: string;
}

export interface ISPStationsResponse {
  stations: {
    success: boolean;
    message: string;
    stations: ISPStation[];
  };
}

export interface ISPStationResponse {
  station: {
    success: boolean;
    message: string;
    station: ISPStation;
  };
}