FROM mcr.microsoft.com/dotnet/aspnet:8.0 AS base
WORKDIR /app
EXPOSE 8080

FROM mcr.microsoft.com/dotnet/sdk:8.0 AS build
WORKDIR /src
COPY ["HRMSService/HRMSService.csproj", "HRMSService/"]
RUN dotnet restore "HRMSService/HRMSService.csproj"
COPY . .
WORKDIR "/src/HRMSService"
RUN dotnet build "HRMSService.csproj" -c Release -o /app/build

FROM build AS publish
RUN dotnet publish "HRMSService.csproj" -c Release -o /app/publish

FROM base AS final
WORKDIR /app
COPY --from=publish /app/publish .
ENTRYPOINT ["dotnet", "HRMSService.dll"]
