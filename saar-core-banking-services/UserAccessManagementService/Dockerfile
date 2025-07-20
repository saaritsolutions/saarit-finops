FROM mcr.microsoft.com/dotnet/aspnet:8.0 AS base
WORKDIR /app
EXPOSE 8080

FROM mcr.microsoft.com/dotnet/sdk:8.0 AS build
WORKDIR /src
COPY ["UserAccessManagementService/UserAccessManagementService.csproj", "UserAccessManagementService/"]
RUN dotnet restore "UserAccessManagementService/UserAccessManagementService.csproj"
COPY . .
WORKDIR "/src/UserAccessManagementService"
RUN dotnet build "UserAccessManagementService.csproj" -c Release -o /app/build

FROM build AS publish
RUN dotnet publish "UserAccessManagementService.csproj" -c Release -o /app/publish

FROM base AS final
WORKDIR /app
COPY --from=publish /app/publish .
ENTRYPOINT ["dotnet", "UserAccessManagementService.dll"]
