FROM nginx:1.27-alpine
LABEL org.opencontainers.image.source="https://github.com/Tony1704/phonewords" \
      org.opencontainers.image.description="Find words in your phone number (T9)" \
      org.opencontainers.image.licenses="MIT"
COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY public/ /usr/share/nginx/html/
EXPOSE 80
