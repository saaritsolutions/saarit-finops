# Functional Requirements to Microservices Mapping

This file maps the major functional requirements from `CBS_Requirements_for_UCBs.txt` to the proposed microservices in the design diagram. Use this as a traceability matrix and a guide for service boundaries and ownership.

| Functional Requirement (CBS_Requirements_for_UCBs.txt)         | Responsible Microservice(s)                |
|---------------------------------------------------------------|--------------------------------------------|
| 1. Account Opening                                            | Account Service, Customer Service, Workflow Orchestration, Business Rules Engine, Product & Param Management |
| 2. Customer Information                                       | Customer Service, Document Management      |
| 3. Cheque Book Facility                                       | Cheque & Clearing Service, Account Service |
| 4. Service Branches and Clearing                              | Cheque & Clearing Service                  |
| 5. Cash Department at Branch                                  | Transaction Service, Account Service, GL & Accounting |
| 6. Cash Credit and Overdraft                                  | Loan Service, Account Service, Product & Param Management, Business Rules Engine |
| 7. Loan Processing                                            | Loan Service, Customer Service, Workflow Orchestration, Product & Param Management, Business Rules Engine |
| 8. Bills                                                      | Transaction Service, GL & Accounting       |
| 9. Remittances                                                | Remittance & Payment Service, Card & ATM Service |
| 10. Interest and Fee Calculation                              | Interest & Fee Service, Deposit Service, GL & Accounting, Compliance Service |
| 11. Transaction Posting                                       | Transaction Service, GL & Accounting       |
| 12. Safe Custody Facility                                     | Locker Service                            |
| 13. Tax Calculation                                           | Interest & Fee Service, Compliance Service |
| 14. Lockers                                                   | Locker Service                            |
| 15. General Ledger                                            | GL & Accounting Service                    |
| 16. Regulatory Requirements                                   | Regulatory & Compliance Service, Reporting & MIS |
| 17. Head Office                                               | GL & Accounting, Reporting & MIS           |
| 18. Reports                                                   | Reporting & MIS Service, Regulatory & Compliance |
| User Management, Access Control                               | User & Access Management Service           |
| Product/Parameter Management                                  | Product & Param Management Service, Low-Code/No-Code Admin, Business Rules Engine |
| Document/Signature/KYC Management                             | Document Management Service, Customer Service |
| Notification/Alerts                                           | Notification Service, Workflow Orchestration |
| Audit, Logging, Exception Reports                             | Audit Logging Service, Versioning & Audit, Compliance |
| HRMS, Staff Management                                        | HRMS Service                              |
| Digital Channels (Web/Mobile/API)                             | API Gateway, Notification, All Domain Svc  |
| Card & ATM Management                                         | Card & ATM Service                        |
| Batch Processing (EOD/EOM)                                    | Transaction, GL & Accounting, Reporting    |
| AML, CERSAI, Statutory/Regulatory Reporting                   | Regulatory & Compliance, Reporting         |
| Product Utilization, Cross-Sell                               | Customer, Product & Param, Notification    |
| Workflow, Approvals, Maker-Checker                            | Workflow Orchestration Service, Account, Loan, Customer |
| Business Rules, Eligibility, Validation                       | Business Rules Engine Service, Product & Param Management |
| Template Management (Docs, UI, Notifications)                 | Template Management Service                |
| Extensions/Custom Logic                                       | Extension/Plug-in Service                  |
| Dynamic Fields/Schema                                         | Dynamic Fields/Schema Service              |
| Versioning, Configuration Audit                               | Versioning & Audit Service                 |

---

- For each requirement, the primary service(s) responsible are listed. Some requirements span multiple services (e.g., Account Opening involves both Account and Customer, and now also Workflow, Rules, Product Mgmt).
- For detailed mapping, refer to the relevant section/page in `CBS_Requirements_for_UCBs.txt` and the service’s API/contract.
- Update this file as services or requirements evolve.
- Ensure all services are properly documented, and their APIs are up-to-date to reflect any changes in requirements or business logic.
