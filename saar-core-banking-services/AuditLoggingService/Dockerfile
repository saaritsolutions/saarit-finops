FROM mcr.microsoft.com/dotnet/aspnet:8.0 AS base
WORKDIR /app
EXPOSE 8080

FROM mcr.microsoft.com/dotnet/sdk:8.0 AS build
WORKDIR /src
COPY ["AuditLoggingService/AuditLoggingService.csproj", "AuditLoggingService/"]
RUN dotnet restore "AuditLoggingService/AuditLoggingService.csproj"
COPY . .
WORKDIR "/src/AuditLoggingService"
RUN dotnet build "AuditLoggingService.csproj" -c Release -o /app/build

FROM build AS publish
RUN dotnet publish "AuditLoggingService.csproj" -c Release -o /app/publish

FROM base AS final
WORKDIR /app
COPY --from=publish /app/publish .
ENTRYPOINT ["dotnet", "AuditLoggingService.dll"]
