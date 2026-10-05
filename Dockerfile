FROM caddy:2-alpine
COPY Caddyfile /etc/caddy/Caddyfile
COPY index.html periodic-table-atoms.html periodic-table-data.js NOTES.md README.md .nojekyll /srv/
COPY vendor /srv/vendor
EXPOSE 8080
CMD ["caddy", "run", "--config", "/etc/caddy/Caddyfile", "--adapter", "caddyfile"]
