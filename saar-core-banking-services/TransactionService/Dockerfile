FROM mcr.microsoft.com/dotnet/aspnet:8.0 AS base
WORKDIR /app
EXPOSE 80

FROM mcr.microsoft.com/dotnet/sdk:8.0 AS build
WORKDIR /src
COPY ["TransactionService/TransactionService.csproj", "TransactionService/"]
RUN dotnet restore "TransactionService/TransactionService.csproj"
COPY . .
WORKDIR "/src/TransactionService"
RUN dotnet build "TransactionService.csproj" -c Release -o /app/build

FROM build AS publish
RUN dotnet publish "TransactionService.csproj" -c Release -o /app/publish

FROM base AS final
WORKDIR /app
COPY --from=publish /app/publish .
ENTRYPOINT ["dotnet", "TransactionService.dll"]
