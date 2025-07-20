FROM mcr.microsoft.com/dotnet/aspnet:8.0 AS base
WORKDIR /app
EXPOSE 80

FROM mcr.microsoft.com/dotnet/sdk:8.0 AS build
WORKDIR /src
COPY ["RegulatoryComplianceService/RegulatoryComplianceService.csproj", "RegulatoryComplianceService/"]
RUN dotnet restore "RegulatoryComplianceService/RegulatoryComplianceService.csproj"
COPY . .
WORKDIR "/src/RegulatoryComplianceService"
RUN dotnet build "RegulatoryComplianceService.csproj" -c Release -o /app/build

FROM build AS publish
RUN dotnet publish "RegulatoryComplianceService.csproj" -c Release -o /app/publish

FROM base AS final
WORKDIR /app
COPY --from=publish /app/publish .
ENTRYPOINT ["dotnet", "RegulatoryComplianceService.dll"]
