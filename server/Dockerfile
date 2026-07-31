FROM node:22-alpine

WORKDIR /app

# prisma + @prisma/client are runtime dependencies here (migrate deploy runs
# at container start), so a plain --omit=dev install is enough.
COPY package.json package-lock.json ./
RUN npm ci --omit=dev

COPY prisma ./prisma
RUN npx prisma generate

COPY . .

RUN mkdir -p uploads

EXPOSE 4000

COPY docker-entrypoint.sh /usr/local/bin/docker-entrypoint.sh
RUN chmod +x /usr/local/bin/docker-entrypoint.sh

ENTRYPOINT ["docker-entrypoint.sh"]
CMD ["node", "src/index.js"]
