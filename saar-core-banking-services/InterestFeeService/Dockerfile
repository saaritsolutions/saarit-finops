FROM mcr.microsoft.com/dotnet/aspnet:8.0 AS base
WORKDIR /app
EXPOSE 80

FROM mcr.microsoft.com/dotnet/sdk:8.0 AS build
WORKDIR /src
COPY ["InterestFeeService/InterestFeeService.csproj", "InterestFeeService/"]
RUN dotnet restore "InterestFeeService/InterestFeeService.csproj"
COPY . .
WORKDIR "/src/InterestFeeService"
RUN dotnet build "InterestFeeService.csproj" -c Release -o /app/build

FROM build AS publish
RUN dotnet publish "InterestFeeService.csproj" -c Release -o /app/publish

FROM base AS final
WORKDIR /app
COPY --from=publish /app/publish .
ENTRYPOINT ["dotnet", "InterestFeeService.dll"]
