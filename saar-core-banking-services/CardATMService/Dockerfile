FROM mcr.microsoft.com/dotnet/aspnet:8.0 AS base
WORKDIR /app
EXPOSE 8080

FROM mcr.microsoft.com/dotnet/sdk:8.0 AS build
WORKDIR /src
COPY ["CardATMService/CardATMService.csproj", "CardATMService/"]
RUN dotnet restore "CardATMService/CardATMService.csproj"
COPY . .
WORKDIR "/src/CardATMService"
RUN dotnet build "CardATMService.csproj" -c Release -o /app/build

FROM build AS publish
RUN dotnet publish "CardATMService.csproj" -c Release -o /app/publish

FROM base AS final
WORKDIR /app
COPY --from=publish /app/publish .
ENTRYPOINT ["dotnet", "CardATMService.dll"]
