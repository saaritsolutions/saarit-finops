# AccountService - Core Banking Microservice

This is the Account microservice for the Core Banking Solution (CBS) for Urban Cooperative Banks (UCBs).

## Features
- .NET 8 Web API (Clean Architecture)
- PostgreSQL integration (EF Core, connection string in appsettings.json)
- OpenAPI/Swagger enabled
- Dockerfile for containerization
- Unit and integration tests (NUnit)
- Sample REST endpoints for account creation and retrieval
- CI/CD pipeline template (GitHub Actions)

## Getting Started

### Prerequisites
- [.NET 8 SDK](https://dotnet.microsoft.com/download)
- [Docker](https://www.docker.com/)
- [PostgreSQL](https://www.postgresql.org/)

### Build & Run (Locally)
```sh
cd AccountService
# Update appsettings.json with your PostgreSQL connection string
 dotnet build
 dotnet run
```

### Run with Docker
```sh
docker build -t accountservice .
docker run -p 8080:80 --env-file .env accountservice
```

### API Documentation
- Swagger UI: http://localhost:8080/swagger

### Testing
```sh
cd AccountService.Tests
dotnet test
```

## Project Structure
- `AccountService/` - Main microservice code
- `AccountService.Tests/` - Unit/integration tests
- `.github/` - Copilot instructions, workflows
- `.vscode/` - VS Code tasks

## CI/CD
- See `.github/workflows/ci.yml` for GitHub Actions pipeline

## Requirements Traceability
- All business logic and endpoints are mapped to requirements in `CBS_Requirements_for_UCBs.txt` (see project root or .github)

---
For more details, see INSTRUCTIONS.md and REQUIREMENT_SERVICE_MAPPING.md in the main repo.
