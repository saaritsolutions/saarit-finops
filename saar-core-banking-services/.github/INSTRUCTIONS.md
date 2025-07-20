# Project Instructions: Core Banking Solution (CBS) for Urban Cooperative Banks (UCBs)

## Vision & Scope
- Build a comprehensive, secure, and modular Core Banking Solution for UCBs, strictly adhering to the requirements in the provided CBS_Requirements_for_UCBs.txt (112 pages).
- Use a microservices architecture, with each major business domain as a separate service.
- Support all functional, technical, regulatory, and operational requirements as per the document.

## Architecture & Technology
- Each microservice must own its own database (PostgreSQL preferred).
- All inter-service communication should be via REST APIs or asynchronous messaging (e.g., RabbitMQ/Kafka) where appropriate.
- Use .NET 8 (or latest LTS) for all backend services.
- Containerize all services (Docker), orchestrate with Kubernetes.
- API Gateway for routing, authentication, throttling, and monitoring.
- Use OAuth2/OIDC for authentication and fine-grained authorization.
- All sensitive data must be encrypted at rest and in transit.
- All services must be stateless and horizontally scalable.

## Coding & Quality Standards
- Follow clean architecture and SOLID principles in all services.
- All business logic must be covered by comprehensive unit and integration tests (NUnit).
- All APIs must be documented with OpenAPI/Swagger.
- Use CI/CD pipelines for build, test, and deployment automation.
- Code reviews are mandatory for all merges to main.
- All code must be well-documented and follow consistent naming conventions.
- Make sure no code files grow beyond 600 lines of code 

## Regulatory & Compliance
- No PII or customer data may be stored or processed outside India.
- All audit, logging, and compliance requirements from the CBS document must be implemented.
- Support for regulatory reporting, audit trails, and exception reports is mandatory.

## Cross-Cutting Concerns
- Centralized logging, monitoring, and alerting (e.g., ELK, Grafana).
- Notification service for SMS, email, and in-app alerts.
- Audit service for tracking all user and system actions.
- Product & parameter management service for all configurable business rules.
- Document management for KYC, signatures, collateral, etc.

## Delivery & Collaboration
- Work incrementally: implement, test, and document one service/domain at a time.
- Keep the context file updated with progress, open issues, and recent changes.
- Use clear, specific prompts for each new feature, review, or fix.
- All requirements from CBS_Requirements_for_UCBs.txt must be traceable to code, tests, or documentation.

## Flexibility & Customization
- All business products, workflows, and rules must be defined via configuration, not hardcoded logic.
- Implement a Product Configuration Engine, Workflow Engine, and Business Rules Engine to allow runtime definition and modification of products, processes, and rules.
- All forms, documents, and notifications must be template-driven and support multi-language/currency.
- Provide extension points and plug-in architecture for custom logic and integrations.
- Support dynamic fields and schema evolution for all major entities.
- All configuration changes must be versioned and auditable.
- Provide low-code/no-code admin tools for business configuration.

## Additional Microservices for Flexibility & Globalization
- **Product Configuration Service:** Manages product templates, metadata, and product lifecycle configuration for all banking products.
- **Workflow Orchestration Service:** Manages dynamic workflows, process definitions, approvals, and routing for all business processes (e.g., account opening, loan origination).
- **Business Rules Engine Service:** Centralizes business rules, eligibility, and validation logic, allowing runtime updates and versioning.
- **Template Management Service:** Handles all document, notification, and UI templates, supporting multi-language and multi-currency.
- **Extension/Plug-in Service:** Provides APIs and runtime for custom plug-ins, extensions, and bank/country-specific modules.
- **Dynamic Fields/Schema Service:** Manages custom fields and schema evolution for products, customers, and transactions.
- **Versioning & Audit Service:** Tracks all configuration, workflow, and product changes with full versioning and audit trails.
- **Low-Code/No-Code Admin Service:** Provides UI and APIs for business users to configure products, workflows, rules, and templates without code changes.

## Refactoring Guidance for Service Implementation
- All existing and new microservices must delegate product configuration, business rule evaluation, workflow orchestration, and template/document generation to the respective engines/services listed above.
- Domain services (e.g., Account, Customer, Loan) should not contain hardcoded product, rule, or workflow logic; instead, they must consume APIs provided by the Product Configuration Service, Business Rules Engine Service, Workflow Orchestration Service, and Template Management Service.
- All validations, eligibility checks, process flows, and document/notification generation must be externalized and managed via these engines, enabling runtime changes and high flexibility.
- Service interfaces and contracts should be designed to support dynamic invocation of these engines, and all configuration-driven logic must be versioned and auditable.
- Refactor legacy or static logic to use these engines incrementally, prioritizing high-variability and high-impact business domains first.

## Out of Scope
- No monolithic implementations.
- No use of proprietary/closed-source technologies unless explicitly approved.

---

**This file is the single source of truth for project rules, standards, and non-negotiable requirements. Update only for major changes.**
