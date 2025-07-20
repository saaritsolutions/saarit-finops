FROM mcr.microsoft.com/dotnet/aspnet:8.0 AS base
WORKDIR /app
EXPOSE 80

FROM mcr.microsoft.com/dotnet/sdk:8.0 AS build
WORKDIR /src
COPY ["GLAccountingService/GLAccountingService.csproj", "GLAccountingService/"]
RUN dotnet restore "GLAccountingService/GLAccountingService.csproj"
COPY . .
WORKDIR "/src/GLAccountingService"
RUN dotnet build "GLAccountingService.csproj" -c Release -o /app/build

FROM build AS publish
RUN dotnet publish "GLAccountingService.csproj" -c Release -o /app/publish

FROM base AS final
WORKDIR /app
COPY --from=publish /app/publish .
ENTRYPOINT ["dotnet", "GLAccountingService.dll"]
