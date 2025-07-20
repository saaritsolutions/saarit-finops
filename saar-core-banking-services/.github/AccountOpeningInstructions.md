Account Opening
• Account opening process should include KYC documents to provide an operative
account. The requirements for opening CASA, fixed deposits and other accounts are
described
• Fresh KYC need not be insisted for transfer of accounts from one branch to another
unless KYC updation is due.
• Provide for generation of alerts on KYC updation every 2/7/10 years in respect of high/
medium/ low risk category customers respectively.
• Introduction of a customer need not be insisted upon.
• Support for following liability products:
• Savings Account – General and Staff, Salary, No-Frill, Pension, SB
Society/Institutional SB Society
• Current Account – Individuals/ Institutions/Organization
• Deposit – General, Society, Organizations.
• Cumulative Fixed Deposit, RD, Savings related insurance Term Deposit, Daily Deposit
• NRE/NRO Accounts
• FCNR accounts (for scheduled UCBs with AD-Category I license only)
• Existence of customer record to be mandatory for opening a new account. Data
cleansing to ensure unique customer id
• Support defining eligibility criteria for different account/customer type
• Provide for capturing details including but not limited to: Title of a/c, Name (First,
Middle, Last name) with salutation e.g. Mr./Ms. key in field, Father’s/Husband’s Name,
Postal Address, Telephone #/ Fax/, Mobile No., E-Mail, Date of Birth, Gender of each
a/c holder and PA holder, if any, PAN#, Passport, Driving License, Voter Identity Card,
Electricity Bill/Telephone Bill/Defence Identity Card, Passport#, UID (Aadhar) Card#,
Details of introducer a/c number and other details as prescribe in IBA Account opening
form
• For current account opening, following details may be captured along with the details
requested in IBA account opening form – Memorandum and Article of
Association/Certificate of incorporation and commencement of business,
Proprietorship letter, Partnership Deed/Letter, Trust Deed, HUF declaration, Resolution 
Core Banking Solution Requirements for Urban Cooperative
Banks: Functional and Technical
Page 10 of 112
of Board/Trust/Clubs/Association/Society, Order of appointment of Executor or
Administrator, Details of A/C with any other bank(s)/or our other branch(es), Power of
Attorney, Copy of PAN Card, Form 60/61, Undertaking to notify the bank of any change
in the partnership/Board
•Provide for capturing mode of operation including but not limited to:
• For individuals: Singly, severally, jointly, either or survivor, former or survivor.
(Jointly or survivor/s)
• For other than individuals (companies/trusts/HUFs/clubs/society, etc.): Any one,
joint, an authorized operator and any one/more of the rest of the authorized
signatories. Also provide for capture of modification with history.
(Panchayats/Panchayat Samiti, etc.)
• Allow updation of the identity details to handle mistakes, if any. However, the updates
have to go through maker-checker process
• Records must be created and authorised by the supervisor as per maker-checker
concept except system generated accounting entries
• Allow for setting of account parameter including but not limited to:
• Debits not allowed, credits not allowed, debit/credit not allowed, debit with
ceiling, credit with ceiling, provide for pop-up message displaying the restriction
giving reason thereof, requiring approval by authorized official. Such transactions
must be listed in the exception report, provide for revocation of such restriction
under authorization.
• Provide for identification of accounts opened with simplified KYC procedure or as
BSBD Accounts including setting transaction limits, outstanding balance limits.
• Provide for identification of accounts under special schemes / eligible for
subsidies/ interest subvention/ pension/ life/ accident insurance, etc. (e.g. PMJDY
accounts)
• Provide facility to stop opening a particular type of account/product type from a
specified date. Existing account to continue unless and until closed or matured
• Provide menu for flagging of accounts of deceased depositors and accounts where
operations have been stopped/restricted under Court-IT Order, etc.
• In case of substitution, original name should be retained with date of change and
exception report to be generated
• Provide a field for storing old account numbers (from earlier legacy system) with
corresponding new account numbers and the date of opening of old account number
• Support recording of mode of deposit of the initial amount: cash/transfer/clearing
• Nominations:
Core Banking Solution Requirements for Urban Cooperative
Banks: Functional and Technical
Page 11 of 112
• Provide facility to specify nomination eligibility based on customer types
• Nomination facility should be offered as a rule. If a customer does not want to nominate,
the same should be recorded.
• Provide for the capture of the following details including but not limited to:
• Name, address, relationship with the account holder, date of birth and signature of the
nominee, name of the person authorized to receive money in case of minor nomination
• Nominations to continue on renewal of deposit unless changed an alert should appear
to this effect at the time of renewal
• Allow for modifications and cancellations of nominations with authorization.
• Provide for flagging the account as a – new a/c for a period of first – x months, ‘x’ to be
defined as a parameter
• Provide capability to group various accounts of a corporate/individuals based on
predefined parameters, e.g. common first accountholder for TDS.
• Provide for setting limits in accounts opened by minors, entering details of legal guardian
• Support printing of pass book/deposit receipt, etc., after authorization of initial credit
• Provide for view of account status (e.g. inoperative/minor/blind/illiterate/KYC norms
complied/frozen, etc.) on deposit of cheque
• Provide for minimum amount with which account can be opened. No minimum balance
should be mandated for BSBDA.
• Provide for alerts if outstanding balance falls below the minimum threshold
• Blocking of an account for specific accounting period/entity/location/branch
• Allow setting of Account Parameter: Account cannot go negative. Necessary alert must
be displayed and the authorized official must approve the debit-transaction
• Closed accounts should be allowed only for enquiry and not for transactions
• Provide for alerts when there are no transactions in an account for two years, sudden
operation in a dormant/inoperative account
• Closure of SB and CA
• Unused cheque must be surrendered or deleted before closure of any account in CA and
SB
• Recover charge of Rs. x if SB/CA account closed within ‘y’ months from date of opening
(other than due to death of the depositor). Where ‘y’ is a parameter.
• Closure/Renewal of Term Deposits
• Provide for sending alerts to customers when an account is reaching maturity or
due for renewal
Core Banking Solution Requirements for Urban Cooperative
Banks: Functional and Technical
Page 12 of 112
• Provide facility for renewal of full or part of the proceeds e.g. principal and
interest, principal, interest and overdue interest, principal only, interest only (i.e.,
without addition of amount), of matured FD for further period, including
retrospective renewal from date of maturity for overdue FD
• Support parameterisation of rate of interest applicable to overdue period of a FD
on prospective renewal after – x‖ days from maturity-date
• Support parameterisation of rate of interest applicable to overdue period of a FD
on settlement of deceased account
• In case of premature closure interest rate for run-period of the deposit is to be
selected from the interest table effective on date of opening and x% penalty to be
charged, 'x' to be set as a parameter
• Premature only from the date of extension
• Account to be termed as closed only when balance is zero and there is nothing
further left to process either in the account in question
• Support maintenance of notional balances in certain types of accounts such as PPF
• Support parameterisation of permissible credits for product-types e.g., the
variable monthly instalment to be deposited by the customer should not exceed
Rs. x
• Calculate and display applicable penalty as applicable
• Provide for generation of notices to be sent to customers in case of overdue
instalments for more than parameterised period
• Provide for applying concessions in charges to specific account/group of accounts
ATM Facility Available
• Population category of the branch like metropolitan, urban, semi-urban and rural,
and/or location such as district head quarter, state capital, etc.
• Allow defining of minimum balance to be maintained on each type of account, on
a daily, monthly, quarterly, half-yearly, yearly basis
• Allow defining of minimum average balance to be maintained on each type of
account, on a daily, monthly, quarterly, half-yearly, yearly basis
• Enable system to levy charges in case of default on instance-basis/period-basis
• Minimum balance charges must be levied before end of day is executed. If the
balance in the account is not sufficient to charge minimum balance charges, a
record must be kept and charges are to be recovered automatically whenever
sufficient balance becomes available in the account
• Provide for setting monetary limits for ATM transactions, levy of charges beyond 
Core Banking Solution Requirements for Urban Cooperative
Banks: Functional and Technical
Page 13 of 112
the minimum number of free transactions
• Provide for alerts when multiple ATM transactions are carried out at odd hours
from unusual locations
Savings Bank Account
• Interest is to be accrued at user-defined interval and applied to all savings
accounts on daily basis based on clear balance at the end of the day and at the
rate given in the interest table
• Rate of interest for different types of customers should be parameterized
• Provide for capability to accrue interest on SB account but not applying
• Provide for interest to be calculated up to the last completed month and credited
to particular SB account at the time of its closure
Current Account
• Provide for payment of interest at parameterized rate on sole proprietorship
account at the time of settlement of deceased-claim
Payment of Interest on Term Deposits
• Allow for creation/maintenance of various modes of interest payment on term
deposits including but not restricted to:
• Fixed Deposit where interest is paid out to the depositor at monthly
(discounted)/Quarterly/other predetermined interval by cash/PO/credit to
designated account (liquidation type)
• Cash Certificate Deposits (CC) where interest is compounded at quarterly
intervals and credited to CC a/c at the end of the financial year/pre-set
interval
• RD interest on the basis of monthly product
• Provide for executing TDS at the time of interest payment or accrual at
predetermined intervals (including quarterly) and as per parameters required for
calculation of applicable tax, with facility for clubbing all taxable interest income
of a particular customer
• Provide for facility to capture and apply/revoke tax exemptions either on the basis
of depositor’s declaration or by virtue of exemption as a customer-type
• Support remittance of amount of TDS within user-defined period and generation
of interest and TDS certificate at predefined periods
• Provide for capturing account/ transaction details of a customer across accounts/
branches for the purpose of TDS, submission of Form 15G/15H, CTR/ STR, 
Core Banking Solution Requirements for Urban Cooperative
Banks: Functional and Technical
Page 14 of 112
verification of KYC
• Support generation of yearly ticklers to the customer within a user defined period
say for TDS declaration
• Provide for conversion of full or part of one type of deposit into another with
facility of waiver of penal interest on premature payment of a term deposit
converted into another term deposit
Other Types of Term Deposit
• Support maintenance of:
• CC Interest Accrual Account for holding CC quarterly accruals
• Interest Paid CC Account for making payments of interest on CC for current
quarter
• Interest Accrued and Payable Non-CC for holding quarterly accruals of term
deposits. The balance to be credited to Interest Paid Non-CC on the first
working day of the new quarter
• Interest Paid Non-CC for making payments of interest on Non-CC Term Deposits for
current quarter
• In case of premature payment provide for reversal of recoverable interest from CC
account to CC interest account
• System to support parameterized interest payments for different types of accounts in
respect of period and rate of interest and recovery of excess interest already paid in
case the deposit does not run for a minimum period. System to support accrual of
interest with or without application at parameterized intervals on authorization
• Support parameterized payment of interest in case of deceased account
• Support mode of payment of interest like cash/electronic clearing/transfer/other
remittance mode, etc.
• Support crediting of interest to loan account in case of lien marking on deposit account
to loan account and interest is liquidated periodically
• Support flagging of Recurring Deposit (RD) accounts where monthly instalment is not
received in any month
• Display number of arrears instalment
Loan Against Deposit
• Support marking of lien on deposits (including CC) against which loan/overdraft
has been sanctioned and only then disburse the loan
• Denial of closure of such deposit accounts by the system if corresponding loan is
not fully adjusted. Provision for automatic closure of loan against
Core Banking Solution Requirements for Urban Cooperative
Banks: Functional and Technical
Page 15 of 112
• Deposit account/s on maturity payment of fixed deposit account
• Support tagging of interest and principal in loan account to such deposit account
with alert if the former exceeds y% of the interest and principal amount of deposit
• Support automatic lifting of lien when loan/overdraft is adjusted
• Support opening of a single loan account against many deposits
Closure of Account: Provide facilities including but not restricted to:
• validation with respect to lien/earmarking, pending debit/credit, recovery of any
outstanding charges, instructions like no operation/no withdrawal, unused
cheques, stop payment instructions, instruments outstanding in clearing, outward
bills for collection and bills purchased, standing instructions, instruction for credit
of interest and/or principal of term deposit, outstanding ATM/Debit/Credit Card
or any other restriction to closure
• Validation for lost postal receipts (NSC/KVP) and demand drafts; bank initiated closure
will need validation in terms of prior notice
• Support payment of proceeds by Pay Order/credit to designated account/conversion
fully or partly to a fresh Term Deposit/Demand Draft, etc. Payment by cash restricted
to parameterized amount at product-level.
