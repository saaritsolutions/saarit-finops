# DynamicFieldsSchemaService

## Purpose
Stores and serves bank-specific form field schemas, enabling each bank to have custom fields on loan applications, customer forms, and account opening forms without code changes.

## Port
`:5013`

## Responsibilities
- Store JSON schema definitions for each product/form type per bank
- Serve form schemas to the React frontend for dynamic form rendering
- Validate submitted form data against stored schema
- Support field types: text, number, date, dropdown, radio, checkbox, file upload
- Support conditional visibility (show field B only if field A = 'yes')
- Support bank-specific field labels, options, and validation rules

## Key API Endpoints
| Method | Path | Description |
|---|---|---|
| GET | `/api/DynamicForm/{formType}` | Get schema for a form type |
| GET | `/api/DynamicForm/{bankId}/{formType}` | Get bank-specific schema |
| POST | `/api/DynamicForm` | Create new form schema |
| PUT | `/api/DynamicForm/{id}` | Update schema |
| POST | `/api/DynamicForm/validate` | Validate submitted data |
| GET | `/api/AIForm/generate` | AI-generate form schema from spec |

## Form Types
| Form Type | Used By |
|---|---|
| `personal_loan` | Loan origination — personal loans |
| `home_loan` | Loan origination — home loans |
| `account_opening_sb` | Account opening — savings bank |
| `account_opening_fd` | Account opening — fixed deposit |
| `kyc_individual` | Customer KYC — individuals |
| `kyc_corporate` | Customer KYC — corporate |

## Schema Format (JSON Schema compatible)
```json
{
  "formType": "personal_loan",
  "bankId": "KL001UCB",
  "title": "Personal Loan Application",
  "fields": [
    {
      "id": "employment_type",
      "label": "Employment Type",
      "type": "dropdown",
      "required": true,
      "options": ["SALARIED", "SELF_EMPLOYED", "PROFESSIONAL"]
    },
    {
      "id": "monthly_income",
      "label": "Monthly Net Income (₹)",
      "type": "number",
      "required": true,
      "min": 10000,
      "helpText": "After all deductions"
    },
    {
      "id": "employer_name",
      "label": "Employer Name",
      "type": "text",
      "required": true,
      "visibleIf": { "field": "employment_type", "equals": "SALARIED" }
    },
    {
      "id": "business_type",
      "label": "Business Type",
      "type": "text",
      "required": true,
      "visibleIf": { "field": "employment_type", "in": ["SELF_EMPLOYED", "PROFESSIONAL"] }
    }
  ]
}
```

## Customization Example
```
SaaR default personal_loan form: 10 standard fields
Bank KL001UCB adds bank-specific fields:
  - "RBI_Empanelled_Employer" (checkbox) — required for staff loans
  - "Members_Share_Capital" (number) — cooperative-specific field
  - "Guarantor_Count" (dropdown: 0, 1, 2) — bank requires guarantors above ₹2L

These custom fields are stored in DynamicFieldsSchemaService.
Frontend renders them dynamically — zero code change.
ExpressionBuilderService can reference these fields in eligibility expressions.
```

## IDRBT Requirements Met
- Section 5: Parametrization of products without source code modification
- IDRBT P1 Principle: parametrization over customization
- Enables each bank to configure their own forms per RBI branch licensing
