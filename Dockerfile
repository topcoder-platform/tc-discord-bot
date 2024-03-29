FROM node:16.6

# Create app directory
WORKDIR /tc-discord-bot

# Copy package.json and package-lock.json
COPY package*.json ./

# Install packages
RUN npm install

# Copy the app code
COPY . .

# Build the project
RUN npm run build

# Expose ports
EXPOSE 8081

# Run the application
CMD [ "npm", "run", "start:shard" ]
