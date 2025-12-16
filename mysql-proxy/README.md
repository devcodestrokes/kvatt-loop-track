# Kvatt MySQL Proxy

A simple Express API proxy that allows Supabase Edge Functions to access your MySQL database.

## Setup

1. **Install dependencies:**
   ```bash
   cd mysql-proxy
   npm install
   ```

2. **Configure environment:**
   ```bash
   cp .env.example .env
   # Edit .env with your MySQL credentials
   ```

3. **Start the server:**
   ```bash
   npm start
   # Or for development:
   npm run dev
   ```

## Deployment Options

### Option A: PM2 (Recommended for VPS)
```bash
npm install -g pm2
pm2 start index.js --name kvatt-mysql-proxy
pm2 save
pm2 startup
```

### Option B: Docker
```dockerfile
FROM node:18-alpine
WORKDIR /app
COPY package*.json ./
RUN npm install --production
COPY . .
EXPOSE 3001
CMD ["node", "index.js"]
```

### Option C: Railway/Render/Heroku
Just deploy the `mysql-proxy` folder to your preferred PaaS.

## API Endpoints

All endpoints require `x-api-key` header with your `API_SECRET_KEY`.

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/health` | Health check (no auth) |
| GET | `/api/merchants` | Get all merchants with stats |
| GET | `/api/customers?store_id=&limit=&offset=` | Get customers |
| GET | `/api/orders?store_id=&limit=&offset=` | Get orders |
| GET | `/api/analytics?store_id=&start_date=&end_date=` | Get analytics |
| GET | `/api/line-items/:orderId` | Get order line items |
| POST | `/api/query` | Custom query (limited tables) |

## Security Notes

- Always use HTTPS in production
- Keep `API_SECRET_KEY` secret and rotate regularly
- The proxy only allows SELECT operations on whitelisted tables
- Add IP whitelisting if possible in your firewall
