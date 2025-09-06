import type { FormSchema } from '../services/aiFormService';

// World-class, production-grade baseline loan schema (40+ fields) grouped in sections
export const loanDetailedSchema: FormSchema = {
  entityName: 'LoanApplication',
  title: 'Personal Loan Application',
  sections: [
    { key: 'Applicant', title: 'Applicant Details', fields: ['firstName','lastName','dateOfBirth','gender','maritalStatus','nationalId','panNumber','aadharNumber','email','mobileNumber'] },
    { key: 'Address', title: 'Address', fields: ['addressLine1','addressLine2','city','state','postalCode','country'] },
    { key: 'Employment', title: 'Employment & Income', fields: ['employmentType','employerName','workEmail','workPhone','yearsAtEmployer','monthlyIncome','otherIncome','incomeProofType'] },
    { key: 'Loan', title: 'Loan Details', fields: ['loanAmount','tenureMonths','purpose','interestRateType','collateralProvided','collateralDescription'] },
    { key: 'Banking', title: 'Banking Details', fields: ['bankName','accountNumber','ifscCode','accountType','autoDebitConsent'] },
    { key: 'KYC', title: 'KYC & Compliance', fields: ['pepStatus','sanctionsHit','tinNumber','gstNumber','consentKyc','creditBureauConsent'] },
    { key: 'Risk', title: 'Risk & Declarations', fields: ['creditScore','existingEmi','dtiRatio','hasDefaults','defaultsDescription','politicallyExposedRelation'] },
    { key: 'References', title: 'References', fields: ['ref1Name','ref1Phone','ref1Relation','ref2Name','ref2Phone','ref2Relation'] },
  ],
  fields: [
    // Applicant
    { name: 'firstName', label: 'First Name', type: 'text', required: true, maxLength: 64, section: 'Applicant' },
    { name: 'lastName', label: 'Last Name', type: 'text', required: true, maxLength: 64, section: 'Applicant' },
    { name: 'dateOfBirth', label: 'Date of Birth', type: 'date', required: true, section: 'Applicant' },
    { name: 'gender', label: 'Gender', type: 'select', options: [ { value: 'M', label: 'Male' }, { value: 'F', label: 'Female' }, { value: 'O', label: 'Other' } ], section: 'Applicant' },
    { name: 'maritalStatus', label: 'Marital Status', type: 'select', options: [ { value: 'single', label: 'Single' }, { value: 'married', label: 'Married' }, { value: 'divorced', label: 'Divorced' } ], section: 'Applicant' },
    { name: 'nationalId', label: 'National ID', type: 'text', required: true, maxLength: 20, section: 'Applicant' },
    { name: 'panNumber', label: 'PAN Number', type: 'text', required: true, maxLength: 10, validationRegex: '^[A-Z]{5}[0-9]{4}[A-Z]$', section: 'Applicant' },
    { name: 'aadharNumber', label: 'Aadhar Number', type: 'text', required: true, maxLength: 12, validationRegex: '^[0-9]{12}$', section: 'Applicant' },
    { name: 'email', label: 'Email', type: 'text', required: true, validationRegex: '^[^\n@]+@[^\n@]+\.[^\n@]+$', section: 'Applicant' },
    { name: 'mobileNumber', label: 'Mobile Number', type: 'text', required: true, maxLength: 15, section: 'Applicant' },

    // Address
    { name: 'addressLine1', label: 'Address Line 1', type: 'text', required: true, section: 'Address' },
    { name: 'addressLine2', label: 'Address Line 2', type: 'text', section: 'Address' },
    { name: 'city', label: 'City', type: 'text', required: true, section: 'Address' },
    { name: 'state', label: 'State', type: 'text', required: true, section: 'Address' },
    { name: 'postalCode', label: 'Postal Code', type: 'text', required: true, maxLength: 10, section: 'Address' },
    { name: 'country', label: 'Country', type: 'text', required: true, section: 'Address' },

    // Employment & Income
    { name: 'employmentType', label: 'Employment Type', type: 'select', options: [ { value: 'salaried', label: 'Salaried' }, { value: 'self', label: 'Self-Employed' }, { value: 'retired', label: 'Retired' } ], section: 'Employment' },
    { name: 'employerName', label: 'Employer/Business Name', type: 'text', required: true, section: 'Employment' },
    { name: 'workEmail', label: 'Work Email', type: 'text', section: 'Employment' },
    { name: 'workPhone', label: 'Work Phone', type: 'text', section: 'Employment' },
    { name: 'yearsAtEmployer', label: 'Years at Employer/Business', type: 'number', section: 'Employment' },
    { name: 'monthlyIncome', label: 'Monthly Income', type: 'number', required: true, section: 'Employment' },
    { name: 'otherIncome', label: 'Other Monthly Income', type: 'number', section: 'Employment' },
    { name: 'incomeProofType', label: 'Income Proof Type', type: 'select', options: [ { value: 'salarySlip', label: 'Salary Slip' }, { value: 'bankStatement', label: 'Bank Statement' }, { value: 'itr', label: 'ITR' } ], section: 'Employment' },

    // Loan Details
    { name: 'loanAmount', label: 'Loan Amount', type: 'number', required: true, section: 'Loan' },
    { name: 'tenureMonths', label: 'Tenure (Months)', type: 'number', required: true, section: 'Loan' },
    { name: 'purpose', label: 'Purpose of Loan', type: 'select', options: [ { value: 'personal', label: 'Personal' }, { value: 'education', label: 'Education' }, { value: 'medical', label: 'Medical' }, { value: 'wedding', label: 'Wedding' } ], section: 'Loan' },
    { name: 'interestRateType', label: 'Interest Rate Type', type: 'select', options: [ { value: 'fixed', label: 'Fixed' }, { value: 'floating', label: 'Floating' } ], section: 'Loan' },
    { name: 'collateralProvided', label: 'Collateral Provided', type: 'boolean', section: 'Loan' },
    { name: 'collateralDescription', label: 'Collateral Description', type: 'text', section: 'Loan' },

    // Banking
    { name: 'bankName', label: 'Bank Name', type: 'text', required: true, section: 'Banking' },
    { name: 'accountNumber', label: 'Account Number', type: 'text', required: true, section: 'Banking' },
    { name: 'ifscCode', label: 'IFSC Code', type: 'text', required: true, section: 'Banking' },
    { name: 'accountType', label: 'Account Type', type: 'select', options: [ { value: 'savings', label: 'Savings' }, { value: 'current', label: 'Current' } ], section: 'Banking' },
    { name: 'autoDebitConsent', label: 'Auto-Debit Consent (eNACH)', type: 'boolean', section: 'Banking' },

    // KYC & Compliance
    { name: 'pepStatus', label: 'PEP (Politically Exposed Person)', type: 'boolean', section: 'KYC' },
    { name: 'sanctionsHit', label: 'Sanctions/Watchlist Hit', type: 'boolean', section: 'KYC' },
    { name: 'tinNumber', label: 'Tax Identification Number', type: 'text', section: 'KYC' },
    { name: 'gstNumber', label: 'GST Number', type: 'text', section: 'KYC' },
    { name: 'consentKyc', label: 'Consent for KYC Verification', type: 'boolean', required: true, section: 'KYC' },
    { name: 'creditBureauConsent', label: 'Consent to Pull Credit Bureau', type: 'boolean', required: true, section: 'KYC' },

    // Risk & Declarations
    { name: 'creditScore', label: 'Credit Score', type: 'number', section: 'Risk' },
    { name: 'existingEmi', label: 'Existing Monthly EMI (All Loans)', type: 'number', section: 'Risk' },
    { name: 'dtiRatio', label: 'Debt-to-Income Ratio', type: 'number', section: 'Risk' },
    { name: 'hasDefaults', label: 'Any Past Default?', type: 'boolean', section: 'Risk' },
    { name: 'defaultsDescription', label: 'Defaults Description', type: 'text', section: 'Risk' },
    { name: 'politicallyExposedRelation', label: 'Relation to PEP', type: 'text', section: 'Risk' },

    // References
    { name: 'ref1Name', label: 'Reference 1 Name', type: 'text', section: 'References' },
    { name: 'ref1Phone', label: 'Reference 1 Phone', type: 'text', section: 'References' },
    { name: 'ref1Relation', label: 'Reference 1 Relation', type: 'text', section: 'References' },
    { name: 'ref2Name', label: 'Reference 2 Name', type: 'text', section: 'References' },
    { name: 'ref2Phone', label: 'Reference 2 Phone', type: 'text', section: 'References' },
    { name: 'ref2Relation', label: 'Reference 2 Relation', type: 'text', section: 'References' },
  ],
};

export default loanDetailedSchema;
