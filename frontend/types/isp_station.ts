export interface ISPStation {
  id: string;
  name: string;
  description?: string;
  organization: {
    id: string;
    name: string;
  };
  location: string;
  buildingType: string;
  notes?: string;
  status: 'ACTIVE' | 'INACTIVE' | 'MAINTENANCE';
  coordinates?: string;
  createdAt: string;
  updatedAt: string;
}

export interface ISPStationsResponse {
  stations: {
    success: boolean;
    message: string;
    stations: ISPStation[];
    totalCount: number;
  };
}

export interface StationFilterOptions {
  page: number;
  pageSize: number;
  sortBy: string;
  sortDirection: 'asc' | 'desc';
  search: string;
  filterStatus?: string;
}

