FROM node:18-alpine

WORKDIR /app

# Copy package files
COPY package.json package-lock.json* .npmrc ./

# Install dependencies with npm
RUN npm install --legacy-peer-deps

# Copy source code
COPY . .

# Build the app
ENV CI=false
RUN npm run build

# Install serve globally
RUN npm install -g serve

# Expose port
EXPOSE 3000

# Start the app
CMD ["serve", "-s", "build", "-l", "3000"]
