import express from "express";
import mongoose from "mongoose";
import dotenv from "dotenv";
import cors from "cors";
import path from "path";
import { fileURLToPath } from "url";
import productRoutes from "./routes/productroutes.js";
import topSellerRoutes from "./routes/topsellerroutes.js";
import dressStyleRoutes from "./routes/dressstyleroutes.js";


// Configure __dirname equivalent for ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Set configuration directly
const config = {
  PORT: 8000,
  NODE_ENV: 'development',
  MONGODB_URI: 'mongodb+srv://pradipkumarchaudhary06:2JRlU76O5QXlMg9E@cluster2.mak47.mongodb.net/fabricadmin?retryWrites=true&w=majority',
  CLOUDINARY_CLOUD_NAME: 'dhaumphvl',
  CLOUDINARY_API_KEY: '223977999232774',
  CLOUDINARY_API_SECRET: 'A386eCIQlD5V_XxCERgSzUGwdb4',
  CLOUDINARY_FOLDER: 'fabricadmin'
};

// Apply config to process.env
Object.assign(process.env, config);

// Log configuration
console.log(`Environment: ${process.env.NODE_ENV}`);
console.log(`Server will run on port: ${process.env.PORT}`);
console.log('MongoDB URI: ***MongoDB URI is set***');

const app = express();

// Middleware
app.use(cors());
app.use(express.json());

// Debug log to check environment variables
console.log('Environment Variables:', {
  NODE_ENV: process.env.NODE_ENV,
  PORT: process.env.PORT,
  MONGODB_URI: process.env.MONGODB_URI ? '***MONGODB_URI is set***' : 'MONGODB_URI is NOT set'
});

// MongoDB Connection
const connectDB = async () => {
  try {
    if (!process.env.MONGODB_URI) {
      throw new Error('MONGODB_URI is not defined in environment variables');
    }
    await mongoose.connect(process.env.MONGODB_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });
    console.log('MongoDB Connected Successfully');
  } catch (error) {
    console.error('MongoDB Connection Error:', error.message);
    process.exit(1); // Exit process with failure
  }
};

// Connect to MongoDB
connectDB();

// API Routes
app.use("/api/products", productRoutes);
app.use("/api/topsellers", topSellerRoutes);
app.use("/api/dressstyles", dressStyleRoutes);

// Health check endpoint
app.get("/api/health", (req, res) => {
  res.json({ status: "ok", message: "API is running" });
});

// Serve static files from the React app in production
if (process.env.NODE_ENV === 'production') {
  // Set static folder - adjust the path to go up three levels from /api/server.js
  const staticPath = path.join(__dirname, '../../client/build');
  app.use(express.static(staticPath));
  
  console.log('Serving static files from:', staticPath);
  
  // Handle React routing, return all requests to React app
  app.get('*', (req, res) => {
    res.sendFile(path.join(staticPath, 'index.html'), (err) => {
      if (err) {
        console.error('Error sending file:', err);
        res.status(500).json({ 
          error: 'Internal Server Error',
          message: 'Failed to load the application'
        });
      }
    });
  });
} else {
  // Basic route for development
  app.get("/", (req, res) => {
    res.json({
      message: "API is running in development mode",
      environment: process.env.NODE_ENV || 'development',
      timestamp: new Date().toISOString(),
      nodeVersion: process.version,
      platform: process.platform,
      memoryUsage: process.memoryUsage()
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

const PORT = process.env.PORT || 8000;

const server = app.listen(PORT, '0.0.0.0', () => {
  console.log(`Server running in ${process.env.NODE_ENV || 'development'} mode on port ${PORT}`);
  console.log(`API URL: http://localhost:${PORT}`);
});

// Handle unhandled promise rejections
process.on('unhandledRejection', (err) => {
  console.error(`Error: ${err.message}`);
  // Close server & exit process
  server.close(() => process.exit(1));
});
