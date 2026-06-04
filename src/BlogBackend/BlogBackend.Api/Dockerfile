# ---- Build stage ----
FROM mcr.microsoft.com/dotnet/sdk:8.0 AS build
WORKDIR /src

# Copy solution and project files first for layer caching
COPY BlogBackend.sln ./
COPY BlogBackend.Domain/BlogBackend.Domain.csproj BlogBackend.Domain/
COPY BlogBackend.Application/BlogBackend.Application.csproj BlogBackend.Application/
COPY BlogBackend.Infrastructure/BlogBackend.Infrastructure.csproj BlogBackend.Infrastructure/
COPY BlogBackend.Api/BlogBackend.Api.csproj BlogBackend.Api/

RUN dotnet restore BlogBackend.Api/BlogBackend.Api.csproj

# Copy all sources and build
COPY . .
RUN dotnet publish BlogBackend.Api/BlogBackend.Api.csproj -c Release -o /app/publish --no-restore

# ---- Runtime stage ----
FROM mcr.microsoft.com/dotnet/aspnet:8.0 AS runtime
WORKDIR /app

# Non-root user for security
RUN addgroup --system appgroup && adduser --system --ingroup appgroup appuser
USER appuser

COPY --from=build /app/publish .

EXPOSE 8080
ENTRYPOINT ["dotnet", "BlogBackend.Api.dll"]
