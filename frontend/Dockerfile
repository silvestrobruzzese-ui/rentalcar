FROM node:18-alpine

WORKDIR /app

# Copy package files
COPY package.json package-lock.json* .npmrc ./

# Install dependencies with npm
RUN npm install --legacy-peer-deps

# Copy source code
COPY . .

# Build the app (disable ESLint warnings as errors)
ENV CI=false
ENV DISABLE_ESLINT_PLUGIN=true
RUN npm run build

# Install serve globally
RUN npm install -g serve

# Expose port (Railway uses PORT env variable)
EXPOSE 3000

# Start the app using PORT from Railway
CMD sh -c "serve -s build -l \${PORT:-3000}"
