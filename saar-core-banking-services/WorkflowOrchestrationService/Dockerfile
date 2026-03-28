FROM mcr.microsoft.com/dotnet/aspnet:8.0 AS base
WORKDIR /app
EXPOSE 80

FROM mcr.microsoft.com/dotnet/sdk:8.0 AS build
WORKDIR /src
COPY ["WorkflowOrchestrationService/WorkflowOrchestrationService.csproj", "WorkflowOrchestrationService/"]
RUN dotnet restore "WorkflowOrchestrationService/WorkflowOrchestrationService.csproj"
COPY . .
WORKDIR "/src/WorkflowOrchestrationService"
RUN dotnet build "WorkflowOrchestrationService.csproj" -c Release -o /app/build

FROM build AS publish
RUN dotnet publish "WorkflowOrchestrationService.csproj" -c Release -o /app/publish

FROM base AS final
WORKDIR /app
COPY --from=publish /app/publish .
ENTRYPOINT ["dotnet", "WorkflowOrchestrationService.dll"]
