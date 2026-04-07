# 1. Use a lightweight version of Node.js (20+ required for commander@14)
FROM node:20-alpine

# 2. Set the working directory inside the container
WORKDIR /app

# 3. Copy package files and install ONLY production dependencies
COPY package*.json ./
RUN npm install --production

# 4. Copy the rest of the application code
COPY . .

# 5. Expose the default port (documentation)
EXPOSE 3000

# 6. Default command — uses env vars or .env defaults
# For local Docker: docker run -p 3000:3000 caching-proxy --port 3000 --origin http://dummyjson.com
# For cloud (Render): Set PORT, ORIGIN, TTL, CAPACITY as env vars in dashboard
CMD ["node", "src/index.js"]
