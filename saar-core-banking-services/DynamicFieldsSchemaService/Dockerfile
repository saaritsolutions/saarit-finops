FROM mcr.microsoft.com/dotnet/aspnet:8.0 AS base
WORKDIR /app
EXPOSE 80

FROM mcr.microsoft.com/dotnet/sdk:8.0 AS build
WORKDIR /src
COPY ["DynamicFieldsSchemaService/DynamicFieldsSchemaService.csproj", "DynamicFieldsSchemaService/"]
RUN dotnet restore "DynamicFieldsSchemaService/DynamicFieldsSchemaService.csproj"
COPY . .
WORKDIR "/src/DynamicFieldsSchemaService"
RUN dotnet build "DynamicFieldsSchemaService.csproj" -c Release -o /app/build

FROM build AS publish
RUN dotnet publish "DynamicFieldsSchemaService.csproj" -c Release -o /app/publish

FROM base AS final
WORKDIR /app
COPY --from=publish /app/publish .
ENTRYPOINT ["dotnet", "DynamicFieldsSchemaService.dll"]
