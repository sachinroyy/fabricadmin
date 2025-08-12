import express from "express";
import mongoose from "mongoose";
import cors from "cors";
import path from "path";
import { fileURLToPath } from "url";
import productRoutes from "./routes/productroutes.js";
import topSellerRoutes from "./routes/topsellerroutes.js";
import dressStyleRoutes from "./routes/dressstyleroutes.js";

// Configure __dirname equivalent for ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Configuration
const config = {
  PORT: process.env.PORT || 8000,
  NODE_ENV: process.env.NODE_ENV || 'development',
  MONGODB_URI: process.env.MONGODB_URI || 'mongodb+srv://pradipkumarchaudhary06:2JRlU76O5QXlMg9E@cluster2.mak47.mongodb.net/fabricadmin?retryWrites=true&w=majority',
  CLOUDINARY_CLOUD_NAME: process.env.CLOUDINARY_CLOUD_NAME || 'dhaumphvl',
  CLOUDINARY_API_KEY: process.env.CLOUDINARY_API_KEY || '223977999232774',
  CLOUDINARY_API_SECRET: process.env.CLOUDINARY_API_SECRET || 'A386eCIQlD5V_XxCERgSzUGwdb4',
  CLOUDINARY_FOLDER: process.env.CLOUDINARY_FOLDER || 'fabricadmin'
};

// Apply config to process.env
Object.assign(process.env, config);

const app = express();

// Middleware
app.use(cors());
app.use(express.json());

// MongoDB Connection
const connectDB = async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });
    console.log('MongoDB Connected Successfully');
  } catch (error) {
    console.error('MongoDB Connection Error:', error.message);
    process.exit(1);
  }
};

// API Routes
app.use("/api/products", productRoutes);
app.use("/api/topsellers", topSellerRoutes);
app.use("/api/dressstyles", dressStyleRoutes);

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

// Start server
const PORT = process.env.PORT || 8000;
const server = app.listen(PORT, '0.0.0.0', () => {
  console.log(`Server running in ${process.env.NODE_ENV} mode on port ${PORT}`);
  console.log(`API URL: http://localhost:${PORT}`);
});

// Handle unhandled promise rejections
process.on('unhandledRejection', (err) => {
  console.error('Unhandled Rejection:', err);
  if (server) {
    server.close(() => process.exit(1));
  } else {
    process.exit(1);
  }
});

export default app;
