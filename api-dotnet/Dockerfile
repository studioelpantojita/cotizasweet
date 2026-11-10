FROM mcr.microsoft.com/dotnet/sdk:10.0 AS build
WORKDIR /src
COPY api-dotnet/ api-dotnet/
COPY contracts/ contracts/
RUN dotnet restore api-dotnet/Cotiza.Api.csproj --locked-mode && dotnet publish api-dotnet/Cotiza.Api.csproj -c Release -o /out --no-restore
FROM mcr.microsoft.com/dotnet/aspnet:10.0
WORKDIR /app
RUN apt-get update && apt-get install -y --no-install-recommends gosu ca-certificates && rm -rf /var/lib/apt/lists/*
COPY --from=build /out .
RUN mkdir /app/data && chown app:app /app/data && chmod 700 /app/data
ENV ASPNETCORE_ENVIRONMENT=Production ASPNETCORE_HTTP_PORTS=8000 DATABASE_PATH=/app/data/cotiza.sqlite COTIZA_RUNTIME_USER=app
COPY --chmod=755 deploy/container-entrypoint.sh /usr/local/bin/cotiza-entrypoint
EXPOSE 8000
ENTRYPOINT ["/usr/local/bin/cotiza-entrypoint"]
CMD ["dotnet","Cotiza.Api.dll"]
