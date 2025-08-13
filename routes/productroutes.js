import express from "express";
import multer from "multer";
import path from 'path';
import fs from 'fs';
import Product from "../models/product.js";
import { cloudinary } from "../utils/cloudinary.js";

const router = express.Router();

// Ensure uploads directory exists
const uploadsDir = path.join(process.cwd(), 'uploads');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

// Configure multer for file upload
const upload = multer({ 
  storage: multer.diskStorage({
    destination: (req, file, cb) => {
      cb(null, uploadsDir);
    },
    filename: (req, file, cb) => {
      const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
      cb(null, file.fieldname + '-' + uniqueSuffix + path.extname(file.originalname));
    }
  }),
  limits: { 
    fileSize: 10 * 1024 * 1024, // 10MB limit
    files: 1
  },
  fileFilter: (req, file, cb) => {
    const allowedTypes = ['image/jpeg', 'image/png', 'image/webp'];
    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Only image files (JPEG, PNG, WebP) are allowed!'), false);
    }
  }
});

// Clean up uploaded files after processing
const cleanupFile = (file) => {
  if (file && file.path) {
    fs.unlink(file.path, err => {
      if (err) console.error('Error cleaning up file:', err);
    });
  }
};

// POST API - Create Product with Image and Price
router.post("/", upload.single('image'), async (req, res) => {
  try {
    const { name, description, price } = req.body;
    
    // Validate price
    const priceValue = parseFloat(price);
    if (isNaN(priceValue) || priceValue < 0) {
      throw new Error('Price must be a valid positive number');
    }
    
    const productData = { 
      name, 
      description, 
      price: priceValue 
    };
    
    // If image was uploaded, add image URL to product data
    if (req.file) {
      const result = await cloudinary.uploader.upload(req.file.path);
      productData.image = result.secure_url;
      productData.imagePublicId = result.public_id;
      
      // Clean up the uploaded file after successful upload to Cloudinary
      cleanupFile(req.file);
    }
    
    const newProduct = new Product(productData);
    await newProduct.save();
    
    res.status(201).json({ 
      success: true,
      message: "Product created successfully",
      product: newProduct 
    });
  } catch (error) {
    console.error('Error creating product:', error);
    res.status(500).json({ 
      success: false,
      error: error.message || 'Error creating product' 
    });
  }
});

// GET API - Fetch All Products
router.get("/", async (req, res) => {
  try {
    const { search } = req.query;
    let query = {};
    
    if (search) {
      query.$text = { $search: search };
    }
    
    const products = await Product.find(query).sort({ createdAt: -1 });
    res.json({ success: true, count: products.length, products });
  } catch (error) {
    console.error('Error fetching products:', error);
    res.status(500).json({ 
      success: false,
      error: 'Error fetching products' 
    });
  }
});

// GET API - Get Single Product with Related Products
router.get("/:id", async (req, res) => {
  try {
    // Input validation
    const { id } = req.params;
    if (!id.match(/^[0-9a-fA-F]{24}$/)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid product ID format'
      });
    }

    // Find the product
    const product = await Product.findById(id).lean();
    
    if (!product) {
      return res.status(404).json({
        success: false,
        error: 'Product not found'
      });
    }

    // Find related products (products in the same category or price range)
    const relatedProducts = await Product.find({
      _id: { $ne: id }, // Exclude current product
      $or: [
        { category: product.category },
        { 
          price: { 
            $gte: product.price * 0.8, 
            $lte: product.price * 1.2 
          } 
        }
      ]
    })
    .limit(4) // Limit to 4 related products
    .select('name price image') // Only select necessary fields
    .lean();

    // Format the response
    const response = {
      success: true,
      data: {
        product: {
          id: product._id,
          name: product.name,
          description: product.description,
          price: product.price,
          image: product.image,
          createdAt: product.createdAt,
          updatedAt: product.updatedAt
        },
        relatedProducts,
        meta: {
          hasRelatedProducts: relatedProducts.length > 0,
          relatedProductsCount: relatedProducts.length
        }
      }
    };

    // Add cache control headers
    res.set('Cache-Control', 'public, max-age=3600'); // Cache for 1 hour
    return res.json(response);

  } catch (error) {
    console.error('Error fetching product:', error);
    
    // Handle specific error types
    if (error.name === 'CastError') {
      return res.status(400).json({
        success: false,
        error: 'Invalid product ID format'
      });
    }
    
    // Default error response
    res.status(500).json({ 
      success: false,
      error: 'Error fetching product details',
      ...(process.env.NODE_ENV === 'development' && { 
        message: error.message,
        stack: error.stack 
      })
    });
  }
});

// PUT API - Update Product
router.put("/:id", upload.single('image'), async (req, res) => {
  try {
    const { name, description, price } = req.body;
    const updateData = { name, description };
    
    // Validate and update price if provided
    if (price !== undefined) {
      const priceValue = parseFloat(price);
      if (isNaN(priceValue) || priceValue < 0) {
        throw new Error('Price must be a valid positive number');
      }
      updateData.price = priceValue;
    }
    
    // Find the existing product
    const existingProduct = await Product.findById(req.params.id);
    if (!existingProduct) {
      // Clean up the uploaded file if it exists
      if (req.file) {
        cleanupFile(req.file);
      }
      return res.status(404).json({
        success: false,
        error: 'Product not found'
      });
    }
    
    // If new image is uploaded
    if (req.file) {
      try {
        // Delete old image from Cloudinary if it exists
        if (existingProduct.imagePublicId) {
          await cloudinary.uploader.destroy(existingProduct.imagePublicId);
        }
        
        // Upload new image
        const result = await cloudinary.uploader.upload(req.file.path);
        updateData.image = result.secure_url;
        updateData.imagePublicId = result.public_id;
      } catch (error) {
        // Clean up the uploaded file if there's an error
        cleanupFile(req.file);
        throw error;
      }
    }
    
    const updatedProduct = await Product.findByIdAndUpdate(
      req.params.id,
      updateData,
      { new: true, runValidators: true }
    );
    
    res.json({ 
      success: true, 
      message: 'Product updated successfully',
      product: updatedProduct 
    });
  } catch (error) {
    console.error('Error updating product:', error);
    res.status(500).json({ 
      success: false,
      error: 'Error updating product' 
    });
  }
});

// DELETE API - Delete Product
router.delete("/:id", async (req, res) => {
  try {
    const product = await Product.findById(req.params.id);
    
    if (!product) {
      return res.status(404).json({
        success: false,
        error: 'Product not found'
      });
    }
    
    // Delete image from Cloudinary if it exists
    if (product.imagePublicId) {
      await cloudinary.uploader.destroy(product.imagePublicId);
    }
    
    await Product.findByIdAndDelete(req.params.id);
    
    res.json({ 
      success: true, 
      message: 'Product deleted successfully' 
    });
  } catch (error) {
    console.error('Error deleting product:', error);
    res.status(500).json({ 
      success: false,
      error: 'Error deleting product' 
    });
  }
});

export default router;
