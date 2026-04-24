import axios from 'axios';

const BASE_URL   = process.env.REACT_APP_LOAN_SERVICE_BASE_URL || 'http://localhost:5130';
const GOLD_ROOT  = `${BASE_URL}/api/gold-loan`;
const RATE_ROOT  = `${BASE_URL}/api/gold-rate`;

// ── Types ──────────────────────────────────────────────────────────────────────

export interface GoldRateEntry {
  id:               string;
  rateDate:         string;
  ratePerGramFor22K: number;
  source:           string;
  enteredBy:        string;
  createdAt:        string;
  isLatest?:        boolean;
}

export interface GoldPledgeItem {
  id:                  string;
  itemType:            string;
  description?:        string;
  grossWeightGrams:    number;
  stoneDeductionGrams: number;
  netWeightGrams:      number;
  purityCarats:        number;
  purityFactor:        number;
  goldRatePerGram:     number;
  valuedAmount:        number;
  packetNumber?:       string;
  isReleased:          boolean;
  releasedAt?:         string;
  createdAt:           string;
}

export interface GoldLoanAction {
  id:               string;
  action:           string;
  actionDescription?: string;
  actionBy?:        string;
  role?:            string;
  comments?:        string;
  fromStatus?:      string;
  toStatus?:        string;
  actionAt:         string;
}

export interface GoldLoanDetail {
  id:                      string;
  applicationNumber:       string;
  applicantName:           string;
  mobileNumber?:           string;
  email?:                  string;
  panNumber?:              string;
  aadhaarLast4?:           string;
  currentAddressLine1?:    string;
  currentCity?:            string;
  currentState?:           string;
  currentPinCode?:         string;
  purposeOfLoan?:          string;
  requestedAmount:         number;
  status:                  string;
  disbursalJournalNumber?: string;
  formDataJson?:           string;
  createdBy?:              string;
  createdAt:               string;
  updatedAt:               string;
  // GoldLoanDetails
  goldLoanDetailsId:       string;
  goldLoanStatus:          string;
  repaymentScheme:         string;
  tenureMonths:            number;
  maturityDate?:           string;
  sanctionedAmount:        number;
  interestRatePercent:     number;
  totalInterestAmount?:    number;
  totalAmountDue?:         number;
  totalNetWeightGrams:     number;
  totalValuedAmount:       number;
  ltvPercent:              number;
  goldRateAtAppraisal:     number;
  appraiserName?:          string;
  appraiserEmployeeId?:    string;
  vaultLocation?:          string;
  pledgeReceiptNumber?:    string;
  appraisedAt?:            string;
  sanctionedAt?:           string;
  disbursedAt?:            string;
  closedAt?:               string;
  goldReleasedAt?:         string;
  closureJournalNumber?:   string;
  pledgeItems:             GoldPledgeItem[];
  actions:                 GoldLoanAction[];
}

export interface GoldLoanListItem {
  id:                  string;
  applicationNumber:   string;
  applicantName:       string;
  mobileNumber?:       string;
  panNumber?:          string;
  goldLoanStatus:      string;
  totalNetWeightGrams: number;
  totalValuedAmount:   number;
  ltvPercent:          number;
  sanctionedAmount:    number;
  disbursedAt?:        string;
  maturityDate?:       string;
  closedAt?:           string;
  createdAt:           string;
}

export interface GoldLoanListResponse {
  total:    number;
  page:     number;
  pageSize: number;
  items:    GoldLoanListItem[];
}

export interface CreateGoldLoanRequest {
  applicantName:      string;
  mobileNumber?:      string;
  email?:             string;
  panNumber?:         string;
  aadhaarLast4?:      string;
  addressLine1?:      string;
  city?:              string;
  state?:             string;
  pinCode?:           string;
  purposeOfLoan?:     string;
  requestedAmount:    number;
  tenureMonths:       number;
  interestRatePercent: number;
  customFieldsJson?:  string;
}

export interface AddPledgeItemRequest {
  itemType:            string;
  description?:        string;
  grossWeightGrams:    number;
  stoneDeductionGrams: number;
  purityCarats:        number;
  packetNumber?:       string;
}

export interface GoldLoanActionRequest {
  action:                    string;
  // APPRAISE
  appraiserName?:            string;
  appraiserEmployeeId?:      string;
  vaultLocation?:            string;
  // SANCTION
  sanctionedAmount?:         number;
  comments?:                 string;
  // DISBURSE
  disbursementAccountNumber?: string;
  // CLOSE
  principalRepaid?:          number;
  interestPaid?:             number;
}

// ── Gold Rate API ──────────────────────────────────────────────────────────────

export async function getTodayGoldRate(): Promise<GoldRateEntry> {
  const res = await axios.get<GoldRateEntry>(`${RATE_ROOT}/today`);
  return res.data;
}

export async function getGoldRateHistory(days = 30): Promise<GoldRateEntry[]> {
  const res = await axios.get<GoldRateEntry[]>(`${RATE_ROOT}?days=${days}`);
  return res.data;
}

export async function createGoldRate(payload: {
  rateDate:         string;
  ratePerGramFor22K: number;
  source?:          string;
  enteredBy?:       string;
}): Promise<GoldRateEntry> {
  const res = await axios.post<GoldRateEntry>(RATE_ROOT, payload);
  return res.data;
}

// ── Gold Loan API ──────────────────────────────────────────────────────────────

export async function createGoldLoanApplication(
  req: CreateGoldLoanRequest,
): Promise<{ id: string; applicationNumber: string; goldLoanStatus: string }> {
  const res = await axios.post(`${GOLD_ROOT}/applications`, req);
  return res.data;
}

export async function getGoldLoanApplications(params: {
  status?:   string;
  search?:   string;
  page?:     number;
  pageSize?: number;
}): Promise<GoldLoanListResponse> {
  const res = await axios.get<GoldLoanListResponse>(`${GOLD_ROOT}/applications`, { params });
  return res.data;
}

export async function getGoldLoanDetail(id: string): Promise<GoldLoanDetail> {
  const res = await axios.get<GoldLoanDetail>(`${GOLD_ROOT}/applications/${id}`);
  return res.data;
}

export async function addPledgeItem(
  applicationId: string,
  item: AddPledgeItemRequest,
): Promise<GoldPledgeItem> {
  const res = await axios.post<GoldPledgeItem>(
    `${GOLD_ROOT}/applications/${applicationId}/pledge-items`,
    item,
  );
  return res.data;
}

export async function removePledgeItem(
  applicationId: string,
  itemId: string,
): Promise<void> {
  await axios.delete(`${GOLD_ROOT}/applications/${applicationId}/pledge-items/${itemId}`);
}

export async function takeGoldLoanAction(
  applicationId: string,
  req: GoldLoanActionRequest,
): Promise<Partial<GoldLoanDetail>> {
  const res = await axios.post(`${GOLD_ROOT}/applications/${applicationId}/action`, req);
  return res.data;
}
