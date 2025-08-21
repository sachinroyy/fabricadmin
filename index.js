import express from "express";
import mongoose from "mongoose";
import cors from "cors";
import path from "path";
import { fileURLToPath } from "url";
import cookieParser from "cookie-parser";
import dotenv from "dotenv";
import productRoutes from "./routes/productroutes.js";
import topSellerRoutes from "./routes/topsellerroutes.js";
import dressStyleRoutes from "./routes/dressstyleroutes.js";
import authRoutes from "./routes/authroutes.js";
import cartRoutes from "./routes/cartroutes.js";
// Configure __dirname equivalent for ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load environment variables early
dotenv.config();

// Configuration
const config = {
  PORT: process.env.PORT || 8000,
  NODE_ENV: process.env.NODE_ENV || 'development',
  MONGODB_URI: process.env.MONGODB_URI || 'mongodb+srv://pradipkumarchaudhary06:2JRlU76O5QXlMg9E@cluster2.mak47.mongodb.net/fabricadmin?retryWrites=true&w=majority',
  CLOUDINARY_CLOUD_NAME: process.env.CLOUDINARY_CLOUD_NAME || 'dhaumphvl',
  CLOUDINARY_API_KEY: process.env.CLOUDINARY_API_KEY || '223977999232774',
  CLOUDINARY_API_SECRET: process.env.CLOUDINARY_API_SECRET || 'A386eCIQlD5V_XxCERgSzUGwdb4',
  CLOUDINARY_FOLDER: process.env.CLOUDINARY_FOLDER || 'fabricadmin',
  // CLIENT_ORIGIN: process.env.CLIENT_ORIGIN || 'http://localhost:5173',
  CLIENT_ORIGINS: process.env.CLIENT_ORIGINS || 'https://fabric-phi-nine.vercel.app',

  // IMPORTANT: Must match the clientId used by GoogleOAuthProvider in the frontend
  GOOGLE_CLIENT_ID: process.env.GOOGLE_CLIENT_ID || '330609866345-0tir9es9jgovag6nrl221kl2mdrl6r0b.apps.googleusercontent.com',
  JWT_SECRET: process.env.JWT_SECRET || 'dev_secret_change_me'
};

// Apply config to process.env
Object.assign(process.env, config);

const app = express();

// Middleware
// CORS: allow single origin via CLIENT_ORIGIN or multiple via CLIENT_ORIGINS (comma-separated)
const allowedOrigins = (
  process.env.CLIENT_ORIGINS?.split(',')
    .map(o => o.trim())
    .filter(Boolean)
    || []
);
if (process.env.CLIENT_ORIGIN && !allowedOrigins.includes(process.env.CLIENT_ORIGIN)) {
  allowedOrigins.push(process.env.CLIENT_ORIGIN);
}

app.use(cors({
  origin: function (origin, callback) {
    // Allow mobile apps or curl with no origin
    if (!origin) return callback(null, true);
    if (allowedOrigins.includes(origin)) {
      return callback(null, true);
    }
    return callback(new Error(`CORS blocked for origin: ${origin}`));
  },
  credentials: true,
}));

// Handle preflight for all routes
app.options('*', cors({
  origin: function (origin, callback) {
    if (!origin) return callback(null, true);
    if (allowedOrigins.includes(origin)) return callback(null, true);
    return callback(new Error(`CORS blocked for origin: ${origin}`));
  },
  credentials: true,
}));

app.use(express.json());
app.use(cookieParser());

if (!process.env.GOOGLE_CLIENT_ID) {
  console.warn('[auth] WARNING: GOOGLE_CLIENT_ID is not set via environment. Using default from index.js.');
}

// If deploying behind a proxy and using secure cookies, trust proxy
app.set('trust proxy', 1);

// MongoDB Connection
const connectDB = async () => {
  try {
    const conn = await mongoose.connect(process.env.MONGODB_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
      serverSelectionTimeoutMS: 30000, // 30 seconds timeout for server selection
      socketTimeoutMS: 45000, // Close sockets after 45 seconds of inactivity
      connectTimeoutMS: 10000, // 10 seconds to connect to MongoDB
      maxPoolSize: 10, // Maintain up to 10 socket connections
      retryWrites: true,
      w: 'majority'
    });
    
    console.log(`MongoDB Connected: ${conn.connection.host}`);
    
    // Handle connection events
    mongoose.connection.on('connected', () => {
      console.log('Mongoose connected to DB');
    });
    
    mongoose.connection.on('error', (err) => {
      console.error('Mongoose connection error:', err);
    });
    
    mongoose.connection.on('disconnected', () => {
      console.log('Mongoose disconnected');
    });
    
    return conn;
   } catch (error) {
    console.error('MongoDB Connection Error:', error.message);
    // Exit process with failure
    process.exit(1);
  }
};

// API Routes
app.use("/api/products", productRoutes);
app.use("/api/topsellers", topSellerRoutes);
app.use("/api/dressstyles", dressStyleRoutes);
app.use("/api/auth", authRoutes);
app.use("/api/cart", cartRoutes);

// Minimal Sign-in Page with Google Identity Services
app.get('/signin', (req, res) => {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const apiBase = process.env.API_BASE_URL || '';
  const html = `<!doctype html>
  <html lang="en">
    <head>
      <meta charset="utf-8" />
      <meta name="viewport" content="width=device-width, initial-scale=1" />
      <title>Sign in</title>
      <script src="https://accounts.google.com/gsi/client" async defer></script>
      <style>
        body { font-family: system-ui, -apple-system, Segoe UI, Roboto, Arial; display:flex; align-items:center; justify-content:center; height:100vh; margin:0; background:#0f172a; color:#e2e8f0; }
        .card { background:#111827; padding:32px; border-radius:16px; box-shadow: 0 10px 30px rgba(0,0,0,0.3); width: 360px; text-align:center; }
        .title { margin:0 0 12px; font-size:24px; }
        .desc { margin:0 0 24px; color:#94a3b8; }
        .status { margin-top:16px; font-size:14px; color:#94a3b8; min-height:20px; }
      </style>
    </head>
    <body>
      <div class="card">
        <h1 class="title">Welcome</h1>
        <p class="desc">Sign in with Google to continue</p>
        <div id="g_id_onload"
             data-client_id="${clientId}"
             data-callback="handleCredentialResponse"
             data-auto_prompt="false"
             data-context="signin">
        </div>
        <div class="g_id_signin" data-type="standard" data-size="large" data-theme="outline" data-text="signin_with" data-shape="rect" data-logo_alignment="left"></div>
        <div class="status" id="status"></div>
      </div>
      <script>
        async function handleCredentialResponse(response) {
          const status = document.getElementById('status');
          status.textContent = 'Signing in...';
          try {
            const res = await fetch('${apiBase}/api/auth/google' || '/api/auth/google', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              credentials: 'include',
              body: JSON.stringify({ credential: response.credential })
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.message || 'Sign-in failed');
            status.textContent = 'Signed in as ' + (data.user?.email || 'user');
          } catch (e) {
            status.textContent = 'Error: ' + e.message;
          }
        }
      </script>
    </body>
  </html>`;
  res.setHeader('Content-Type', 'text/html').send(html);
});

// Health check endpoint
app.get("/api/health", (_, res) => {
  res.json({ status: "ok", message: "API is running" });
});

// Serve static files in production
if (process.env.NODE_ENV === 'production') {
  const staticPath = path.join(__dirname, '../../client/build');
  app.use(express.static(staticPath));
  
  app.get('*', (_, res) => {
    res.sendFile(path.join(staticPath, 'index.html'));
  });
} else {
  app.get("/", (_, res) => {
    res.json({
      message: "API is running in development mode",
      environment: process.env.NODE_ENV,
      timestamp: new Date().toISOString()
    });
  });
}

// 404 handler
app.use((req, res) => {
  res.status(404).json({
    success: false,
    message: 'Route not found',
    path: req.path,
    method: req.method
  });
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error('Error:', err.stack);
  res.status(500).json({
    success: false,
    message: 'Internal Server Error',
    error: process.env.NODE_ENV === 'development' ? err.message : {}
  });
});

// Start server with MongoDB connection
const PORT = process.env.PORT || 8000;
let server;
const startServer = async () => {
  try {
    await connectDB();
    server = app.listen(PORT, '0.0.0.0', () => {
      console.log(`Server running in ${process.env.NODE_ENV} mode on port ${PORT}`);
      console.log(`API URL: http://localhost:${PORT}`);
    });

    // Handle unhandled promise rejections
    process.on('unhandledRejection', (err) => {
      console.error('UNHANDLED REJECTION! Shutting down...');
      console.error(err);
      server.close(() => {
        process.exit(1);
      });
    });
  } catch (err) {
    console.error('Failed to start server:', err);
    process.exit(1);
  }
};

// Start the application
startServer();

export default app;
