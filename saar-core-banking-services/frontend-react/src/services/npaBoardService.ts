import axios from 'axios';

const BASE_URL = process.env.REACT_APP_LOAN_SERVICE_BASE_URL || 'http://localhost:5130';
const NPA_URL  = `${BASE_URL}/api/loans/npa-board`;

// ── Response types ─────────────────────────────────────────────────────────

export interface NpaLoanItem {
  id:                   string;
  applicationNumber:    string;
  applicantName:        string;
  productType:          string;
  outstandingPrincipal: number;
  overdueDays:          number;
  smaStatus:            string;
  npaSubClassification: string | null;
  requiredProvisioning: number;
}

export interface SmaWatchItem {
  id:                   string;
  applicationNumber:    string;
  applicantName:        string;
  productType:          string;
  outstandingPrincipal: number;
  overdueDays:          number;
  smaStatus:            string;
}

export interface WrittenOffLoanItem {
  id:                    string;
  applicationNumber:     string;
  applicantName:         string;
  productType:           string;
  outstandingPrincipal:  number;
  writeOffDate:          string | null;
  writeOffReason:        string | null;
  writeOffJournalNumber: string | null;
}

export interface NpaBoardResult {
  asOfDate:                  string;
  totalLoanBook:             number;
  totalNpaOutstanding:       number;
  npaRatio:                  number;
  totalRequiredProvisioning: number;
  smaWatchCount:             number;
  smaWatchOutstanding:       number;
  writtenOffCount:           number;
  writtenOffOutstanding:     number;
  npaLoans:                  NpaLoanItem[];
  smaWatchList:              SmaWatchItem[];
  writtenOffLoans:           WrittenOffLoanItem[];
}

export interface WriteOffRequest {
  reason:       string;
  authorizedBy: string;
}

// ── API functions ──────────────────────────────────────────────────────────

export async function getNpaBoard(): Promise<NpaBoardResult> {
  const res = await axios.get<NpaBoardResult>(NPA_URL);
  return res.data;
}

export async function writeOffLoan(id: string, req: WriteOffRequest): Promise<void> {
  await axios.post(`${BASE_URL}/api/loans/${id}/write-off`, req);
}
