# How to Run the Backend

## Method 1: Docker (Recommended - Easiest)

### Step 1: Install Docker Desktop
Download and install Docker Desktop for Windows:
https://www.docker.com/products/docker-desktop

### Step 2: Create Environment File
```bash
# Copy the example environment file
copy .env.example .env
```

### Step 3: Edit .env File
Open `.env` in a text editor and change these values:
```env
POSTGRES_PASSWORD=MySecurePassword123
MONGO_PASSWORD=MySecurePassword123
REDIS_PASSWORD=MySecurePassword123
MINIO_ROOT_PASSWORD=MySecurePassword123
JWT_SECRET=this_is_a_very_long_secret_key_at_least_32_characters_long
JWT_REFRESH_SECRET=this_is_another_very_long_secret_key_at_least_32_chars
```

### Step 4: Start All Services
```bash
docker-compose up -d
```

This will start:
- PostgreSQL database
- MongoDB database
- Redis cache
- MinIO file storage
- Backend API server

### Step 5: Check if Running
```bash
# Check all services are running
docker-compose ps

# View backend logs
docker-compose logs -f backend
```

### Step 6: Create MinIO Bucket
```bash
# Windows Command Prompt
docker-compose exec minio mc alias set myminio http://localhost:9000 admin MySecurePassword123
docker-compose exec minio mc mb myminio/rtc-files
```

### Step 7: Test the API
Open your browser or use curl:
```
http://localhost:3001/health
```

You should see: `{"status":"ok","timestamp":"..."}`

---

## Method 2: Local Development (Without Docker)

### Prerequisites
1. Install Node.js 20+: https://nodejs.org/
2. Install PostgreSQL 15+: https://www.postgresql.org/download/windows/
3. Install MongoDB 7+: https://www.mongodb.com/try/download/community
4. Install Redis: https://github.com/microsoftarchive/redis/releases

### Step 1: Install Backend Dependencies
```bash
cd backend
npm install
```

### Step 2: Setup PostgreSQL
Open PostgreSQL command line (psql) and run:
```sql
CREATE DATABASE rtc_app;
CREATE USER rtc_user WITH PASSWORD 'your_password';
GRANT ALL PRIVILEGES ON DATABASE rtc_app TO rtc_user;
\q
```

### Step 3: Create .env File
```bash
cd backend
copy .env.example .env
```

Edit `backend/.env`:
```env
NODE_ENV=development
PORT=3001
DATABASE_URL=postgresql://rtc_user:your_password@localhost:5432/rtc_app
MONGODB_URI=mongodb://localhost:27017/rtc_app
REDIS_URL=redis://localhost:6379
JWT_SECRET=your_jwt_secret_key_min_32_characters_long
JWT_REFRESH_SECRET=your_refresh_secret_key_min_32_characters_long
S3_ENDPOINT=http://localhost:9000
S3_ACCESS_KEY=minioadmin
S3_SECRET_KEY=minioadmin
S3_BUCKET=rtc-files
FRONTEND_URL=http://localhost:3000
```

### Step 4: Run Database Migrations
```bash
npm run migrate
```

### Step 5: Start the Server
```bash
npm run dev
```

The server will start on http://localhost:3001

---

## Testing the Backend

### 1. Health Check
```bash
curl http://localhost:3001/health
```

### 2. Register a User
```bash
curl -X POST http://localhost:3001/api/auth/register ^
  -H "Content-Type: application/json" ^
  -d "{\"email\":\"test@example.com\",\"username\":\"testuser\",\"password\":\"SecurePassword123!\"}"
```

### 3. Login
```bash
curl -X POST http://localhost:3001/api/auth/login ^
  -H "Content-Type: application/json" ^
  -d "{\"email\":\"test@example.com\",\"password\":\"SecurePassword123!\"}"
```

---

## Stopping the Backend

### Docker
```bash
# Stop all services
docker-compose down

# Stop and remove all data (WARNING: deletes everything)
docker-compose down -v
```

### Local Development
Press `Ctrl+C` in the terminal where the server is running

---

## Troubleshooting

### Port Already in Use
```bash
# Find what's using port 3001
netstat -ano | findstr :3001

# Kill the process (replace PID with actual process ID)
taskkill /PID <PID> /F
```

### Docker Services Not Starting
```bash
# Check Docker Desktop is running
# Restart Docker Desktop
# Check logs
docker-compose logs
```

### Database Connection Failed
```bash
# Check if PostgreSQL is running
sc query postgresql-x64-15

# Check if MongoDB is running
sc query MongoDB

# Restart services if needed
```

### Can't Access API
- Make sure firewall allows port 3001
- Check if backend is running: `docker-compose ps`
- Check logs: `docker-compose logs backend`

---

## Next Steps

1. Backend is now running on http://localhost:3001
2. You can test all API endpoints
3. Build the frontend to connect to this backend
4. Use WebSocket client to test real-time features

## Useful Commands

```bash
# View all running containers
docker-compose ps

# View backend logs
docker-compose logs -f backend

# Restart backend only
docker-compose restart backend

# Access PostgreSQL
docker-compose exec postgres psql -U rtc_user -d rtc_app

# Access MongoDB
docker-compose exec mongodb mongosh -u admin -p

# Access Redis
docker-compose exec redis redis-cli -a your_password
```
