FROM python:3.12-slim
WORKDIR /app
RUN apt-get update && apt-get install -y --no-install-recommends gosu ca-certificates && rm -rf /var/lib/apt/lists/*
COPY api-python/requirements.lock.txt ./
RUN pip install --no-cache-dir -r requirements.lock.txt
COPY api-python/ /app/api-python/
COPY contracts/ /app/contracts/
RUN useradd --create-home --uid 10001 cotiza && mkdir /app/data && chown cotiza:cotiza /app/data && chmod 700 /app/data
WORKDIR /app/api-python
ENV APP_ENV=production DATABASE_PATH=/app/data/cotiza.sqlite COTIZA_RUNTIME_USER=cotiza
COPY --chmod=755 deploy/container-entrypoint.sh /usr/local/bin/cotiza-entrypoint
EXPOSE 8000
ENTRYPOINT ["/usr/local/bin/cotiza-entrypoint"]
CMD ["uvicorn","ruc_service:app","--host","0.0.0.0","--port","8000","--no-access-log"]
