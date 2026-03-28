FROM mcr.microsoft.com/dotnet/aspnet:8.0 AS base
WORKDIR /app
EXPOSE 80

FROM mcr.microsoft.com/dotnet/sdk:8.0 AS build
WORKDIR /src
COPY ["ExpressionBuilderService/ExpressionBuilderService.csproj", "ExpressionBuilderService/"]
RUN dotnet restore "ExpressionBuilderService/ExpressionBuilderService.csproj"
COPY . .
WORKDIR "/src/ExpressionBuilderService"
RUN dotnet build "ExpressionBuilderService.csproj" -c Release -o /app/build

FROM build AS publish
RUN dotnet publish "ExpressionBuilderService.csproj" -c Release -o /app/publish

FROM base AS final
WORKDIR /app
COPY --from=publish /app/publish .
ENTRYPOINT ["dotnet", "ExpressionBuilderService.dll"]
