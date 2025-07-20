FROM mcr.microsoft.com/dotnet/aspnet:8.0 AS base
WORKDIR /app
EXPOSE 8080

FROM mcr.microsoft.com/dotnet/sdk:8.0 AS build
WORKDIR /src
COPY ["ProductParamManagementService/ProductParamManagementService.csproj", "ProductParamManagementService/"]
RUN dotnet restore "ProductParamManagementService/ProductParamManagementService.csproj"
COPY . .
WORKDIR "/src/ProductParamManagementService"
RUN dotnet build "ProductParamManagementService.csproj" -c Release -o /app/build

FROM build AS publish
RUN dotnet publish "ProductParamManagementService.csproj" -c Release -o /app/publish

FROM base AS final
WORKDIR /app
COPY --from=publish /app/publish .
ENTRYPOINT ["dotnet", "ProductParamManagementService.dll"]
