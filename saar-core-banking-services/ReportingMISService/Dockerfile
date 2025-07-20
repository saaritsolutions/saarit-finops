FROM mcr.microsoft.com/dotnet/aspnet:8.0 AS base
WORKDIR /app
EXPOSE 80

FROM mcr.microsoft.com/dotnet/sdk:8.0 AS build
WORKDIR /src
COPY ["ReportingMISService/ReportingMISService.csproj", "ReportingMISService/"]
RUN dotnet restore "ReportingMISService/ReportingMISService.csproj"
COPY . .
WORKDIR "/src/ReportingMISService"
RUN dotnet build "ReportingMISService.csproj" -c Release -o /app/build

FROM build AS publish
RUN dotnet publish "ReportingMISService.csproj" -c Release -o /app/publish

FROM base AS final
WORKDIR /app
COPY --from=publish /app/publish .
ENTRYPOINT ["dotnet", "ReportingMISService.dll"]
