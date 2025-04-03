export type ISPStation = {
  id: string;
  name: string;
  description?: string;
  location: string;
  buildingType: 'APARTMENT' | 'OFFICE' | 'SCHOOL' | 'HOSPITAL' | 'RESIDENTIAL' | 'COMMERCIAL' | 'INDUSTRIAL' | 'GOVERNMENT' | 'OTHER';
  notes?: string;
  status: 'ACTIVE' | 'INACTIVE' | 'MAINTENANCE' | 'OFFLINE';
  coordinates?: string;
  createdAt: string;
  updatedAt: string;
};

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
