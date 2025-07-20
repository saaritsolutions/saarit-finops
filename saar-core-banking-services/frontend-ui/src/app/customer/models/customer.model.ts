// Customer model matching backend contract
export interface Customer {
  customerId?: number;
  salutation?: string;
  firstName?: string;
  middleName?: string;
  lastName?: string;
  fatherOrHusbandName?: string;
  postalAddress?: string;
  telephone?: string;
  mobile?: string;
  email?: string;
  dateOfBirth: string; // ISO string
  gender?: string;
  pan?: string;
  passport?: string;
  drivingLicense?: string;
  voterId?: string;
  uid?: string;
  introducerAccountNumber?: string;
  customerType?: string;
  createdBy?: string;
  approvedBy?: string;
  approvalStatus?: string;
  createdAt?: string; // ISO string
  approvedAt?: string; // ISO string | null
}
