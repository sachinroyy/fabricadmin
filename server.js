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

// Load environment variables from .env.local
const envPath = path.resolve(__dirname, '.env.local');
dotenv.config({ path: envPath, override: true });

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
// Routes
app.use("/api/products", productRoutes);
app.use("/api/topsellers", topSellerRoutes);
app.use("/api/dressstyles", dressStyleRoutes);

// Basic route for testing
app.get("/", (req, res) => {
  res.send("API is running...");
});

// Error handling middleware
app.use((err, req, res, next) => {
  res.send("API is running...");
});

const PORT = process.env.PORT || 8000;

const server = app.listen(PORT, () => {
  console.log(`Server running in ${process.env.NODE_ENV} mode on port ${PORT}`);
});

// Handle unhandled promise rejections
process.on('unhandledRejection', (err) => {
  console.error(`Error: ${err.message}`);
  // Close server & exit process
  server.close(() => process.exit(1));
});
