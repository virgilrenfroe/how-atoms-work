FROM caddy:2-alpine
COPY Caddyfile /etc/caddy/Caddyfile
COPY *.html *.js /srv/
COPY NOTES.md README.md .nojekyll /srv/
COPY molecules /srv/molecules
COPY vendor /srv/vendor
EXPOSE 8080
CMD ["caddy", "run", "--config", "/etc/caddy/Caddyfile", "--adapter", "caddyfile"]
