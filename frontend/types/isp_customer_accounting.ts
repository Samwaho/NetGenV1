export type AccountingStatusType = 
  | 'Start'
  | 'Stop'
  | 'Interim-Update'
  | 'Accounting-On'
  | 'Accounting-Off'
  | 'session_summary';

export type AccountingStatsPeriod = 
  | 'DAILY'
  | 'WEEKLY'
  | 'MONTHLY'
  | 'YEARLY';

export interface AccountingSession {
  startTime: string;
  endTime: string;
  duration: number;
  inputBytes: number;
  outputBytes: number;
  framedIp?: string;
  terminateCause?: string;
  nasIpAddress?: string;
  serviceType?: string;
  nasPortType?: string;
  nasPort?: string;
  nasIdentifier?: string;
  mikrotikRateLimit?: string;
  calledStationId?: string;
  callingStationId?: string;
}

export interface ISPCustomerAccounting {
  id: string;
  username: string;
  customer: {
    id: string;
    firstName: string;
    lastName: string;
    username: string;
    status: string;
  };
  sessionId?: string;
  status: AccountingStatusType;
  timestamp: string;
  lastUpdate: string;
  type?: string;
  
  // Session data
  sessionTime?: number;
  totalInputBytes?: number;
  totalOutputBytes?: number;
  totalBytes?: number;
  framedIpAddress?: string;
  nasIpAddress?: string;
  terminateCause?: string;
  serviceType?: string;
  nasPortType?: string;
  nasPort?: string;
  nasIdentifier?: string;
  mikrotikRateLimit?: string;
  calledStationId?: string;
  callingStationId?: string;
  
  // Delta values
  deltaInputBytes?: number;
  deltaOutputBytes?: number;
  deltaSessionTime?: number;
  startTime?: string;
  
  // Summary data
  totalSessions?: number;
  totalOnlineTime?: number;
  lastSeen?: string;
  lastSessionId?: string;
  lastSession?: AccountingSession;
}

export interface BandwidthStats {
  period: string;
  download: number;
  upload: number;
  total: number;
}

export interface CustomerAccountingsResponse {
  customerAccountings: {
    success: boolean;
    message: string;
    totalCount: number;
    accountings: ISPCustomerAccounting[];
  };
}

export interface CustomerAccountingResponse {
  customerAccounting: {
    success: boolean;
    message: string;
    accounting: ISPCustomerAccounting;
  };
}

export interface CustomerSessionSummaryResponse {
  customerSessionSummary: {
    success: boolean;
    message: string;
    accounting: ISPCustomerAccounting;
  };
}

export interface CustomerBandwidthStatsResponse {
  customerBandwidthStats: {
    success: boolean;
    message: string;
    customerId?: string;
    username?: string;
    stats: BandwidthStats[];
  };
}
