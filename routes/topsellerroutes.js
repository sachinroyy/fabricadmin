import express from "express";
import multer from "multer";
import path from 'path';
import fs from 'fs';
import TopSeller from "../models/topseller.js";
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
      cb(null, 'topseller-' + uniqueSuffix + path.extname(file.originalname));
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

// POST API - Create Top Seller
router.post("/", upload.single('image'), async (req, res) => {
  try {
    const { name, description, position } = req.body;
    
    if (!name || !description) {
      if (req.file) cleanupFile(req.file);
      return res.status(400).json({ success: false, error: 'Name and description are required' });
    }

    // Check for duplicate name
    const existingSeller = await TopSeller.findOne({ name: name.trim() });
    if (existingSeller) {
      if (req.file) cleanupFile(req.file);
      return res.status(400).json({ success: false, error: 'A top seller with this name already exists' });
    }

    const topSellerData = { 
      name: name.trim(),
      description: description.trim(),
      isActive: true
    };

    // Position validation
    if (position !== undefined && position !== '') {
      const pos = parseInt(position, 10);
      if (isNaN(pos) || pos < 0) {
        if (req.file) cleanupFile(req.file);
        return res.status(400).json({ success: false, error: 'Position must be a non-negative number' });
      }
      const existingWithPosition = await TopSeller.findOne({ position: pos });
      if (existingWithPosition) {
        if (req.file) cleanupFile(req.file);
        return res.status(400).json({ success: false, error: `Position ${pos} is already taken` });
      }
      topSellerData.position = pos;
    }

    // Image upload
    if (req.file) {
      try {
        const result = await cloudinary.uploader.upload(req.file.path, {
          folder: 'fabricadmin/topsellers',
          resource_type: 'auto'
        });
        topSellerData.image = result.secure_url;
        topSellerData.imagePublicId = result.public_id;
      } catch (uploadError) {
        cleanupFile(req.file);
        return res.status(500).json({ success: false, error: 'Image upload failed' });
      } finally {
        cleanupFile(req.file);
      }
    }

    const newTopSeller = new TopSeller(topSellerData);
    await newTopSeller.save();

    res.status(201).json({ success: true, message: "Top seller created successfully", topSeller: newTopSeller });
  } catch (error) {
    console.error('Error in POST /api/topsellers:', error);
    if (error.code === 11000) {
      return res.status(400).json({ 
        success: false, 
        error: 'Duplicate value detected', 
        details: error.keyValue 
      });
    }
    res.status(500).json({ 
      success: false, 
      error: 'Internal server error',
      message: error.message,
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
});


// GET API - Fetch All Top Sellers
router.get("/", async (req, res) => {
  try {
    const { search, active } = req.query;
    let query = {};
    
    // Filter by search term if provided
    if (search) {
      query.$text = { $search: search };
    }
    
    // Filter by active status if provided
    if (active !== undefined) {
      query.isActive = active === 'true';
    }
    
    const topSellers = await TopSeller.find(query).sort({ createdAt: -1 });
    
    res.json({ 
      success: true, 
      count: topSellers.length, 
      topSellers 
    });
  } catch (error) {
    console.error('Error fetching top sellers:', error);
    res.status(500).json({ 
      success: false,
      error: 'Error fetching top sellers' 
    });
  }
});

// GET API - Get Single Top Seller
router.get("/:id", async (req, res) => {
  try {
    const topSeller = await TopSeller.findById(req.params.id);
    
    if (!topSeller) {
      return res.status(404).json({
        success: false,
        error: 'Top seller not found'
      });
    }
    
    res.json({ 
      success: true, 
      topSeller 
    });
  } catch (error) {
    console.error('Error fetching top seller:', error);
    res.status(500).json({ 
      success: false,
      error: 'Error fetching top seller' 
    });
  }
});

// PUT API - Update Top Seller
router.put("/:id", upload.single('image'), async (req, res) => {
  try {
    const { name, description, isActive, position } = req.body;
    const updateData = {};
    
    // Check if the top seller exists
    const existingSeller = await TopSeller.findById(req.params.id);
    if (!existingSeller) {
      if (req.file) cleanupFile(req.file);
      return res.status(404).json({ success: false, error: 'Top seller not found' });
    }
    
    // Handle position update
    if (position !== undefined) {
      const newPosition = parseInt(position, 10);
      if (isNaN(newPosition) || newPosition < 0) {
        if (req.file) cleanupFile(req.file);
        return res.status(400).json({ success: false, error: 'Position must be a non-negative number' });
      }
      
      // Check if the new position is different from current
      if (existingSeller.position !== newPosition) {
        // Check if another seller has this position
        const sellerWithPosition = await TopSeller.findOne({ position: newPosition });
        if (sellerWithPosition && !sellerWithPosition._id.equals(req.params.id)) {
          if (req.file) cleanupFile(req.file);
          return res.status(400).json({ 
            success: false, 
            error: `Position ${newPosition} is already taken by another seller` 
          });
        }
        updateData.position = newPosition;
      }
    }
    
    if (name) updateData.name = name.trim();
    if (description) updateData.description = description.trim();
    if (isActive !== undefined) updateData.isActive = isActive === 'true';
    if (position !== undefined) updateData.position = parseInt(position, 10);
    
    // Find the existing top seller
    const existingTopSeller = await TopSeller.findById(req.params.id);
    if (!existingTopSeller) {
      if (req.file) cleanupFile(req.file);
      return res.status(404).json({
        success: false,
        error: 'Top seller not found'
      });
    }
    
    // If new image is uploaded
    if (req.file) {
      try {
        // Delete old image from Cloudinary if it exists
        if (existingTopSeller.imagePublicId) {
          try {
            await cloudinary.uploader.destroy(existingTopSeller.imagePublicId);
          } catch (destroyError) {
            console.error('Error deleting old image from Cloudinary:', destroyError);
            // Continue with upload even if deletion fails
          }
        }
        
        // Upload new image
        const result = await cloudinary.uploader.upload(req.file.path, {
          folder: 'fabricadmin/topsellers',
          resource_type: 'auto',
          use_filename: true,
          unique_filename: true,
          overwrite: true
        });
        updateData.image = result.secure_url;
        updateData.imagePublicId = result.public_id;
      } catch (uploadError) {
        cleanupFile(req.file);
        return res.status(500).json({
          success: false,
          error: 'Error uploading image to Cloudinary',
          details: process.env.NODE_ENV === 'development' ? uploadError.stack : undefined
        });
      } finally {
        cleanupFile(req.file);
      }
    }
    
    const updatedTopSeller = await TopSeller.findByIdAndUpdate(
      req.params.id,
      updateData,
      { new: true, runValidators: true }
    );
    
    res.json({ 
      success: true, 
      message: 'Top seller updated successfully',
      topSeller: updatedTopSeller 
    });
  } catch (error) {
    console.error('Error updating top seller:', error);
    res.status(500).json({ 
      success: false,
      error: error.message || 'Error updating top seller' 
    });
  }
});

// PATCH API - Update Top Seller Position
router.patch("/:id/position", async (req, res) => {
  try {
    const { position } = req.body;
    
    if (position === undefined || isNaN(parseInt(position, 10))) {
      return res.status(400).json({
        success: false,
        error: 'Valid position is required'
      });
    }
    
    const topSeller = await TopSeller.findById(req.params.id);
    if (!topSeller) {
      return res.status(404).json({
        success: false,
        error: 'Top seller not found'
      });
    }
    
    // Update the position
    topSeller.position = parseInt(position, 10);
    await topSeller.save();
    
    res.json({ 
      success: true, 
      message: 'Position updated successfully',
      topSeller
    });
  } catch (error) {
    console.error('Error updating position:', error);
    res.status(500).json({ 
      success: false,
      error: 'Error updating position' 
    });
  }
});

// PATCH API - Toggle Top Seller Status
router.patch("/:id/toggle-status", async (req, res) => {
  try {
    const topSeller = await TopSeller.findById(req.params.id);
    
    if (!topSeller) {
      return res.status(404).json({
        success: false,
        error: 'Top seller not found'
      });
    }
    
    topSeller.isActive = !topSeller.isActive;
    await topSeller.save();
    
    res.json({ 
      success: true, 
      message: `Top seller ${topSeller.isActive ? 'activated' : 'deactivated'} successfully`,
      topSeller
    });
  } catch (error) {
    console.error('Error toggling top seller status:', error);
    res.status(500).json({ 
      success: false,
      error: 'Error toggling top seller status' 
    });
  }
});

// DELETE API - Delete Top Seller
router.delete("/:id", async (req, res) => {
  try {
    const topSeller = await TopSeller.findById(req.params.id);
    
    if (!topSeller) {
      return res.status(404).json({
        success: false,
        error: 'Top seller not found'
      });
    }
    
    // Delete image from Cloudinary if it exists
    if (topSeller.imagePublicId) {
      try {
        await cloudinary.uploader.destroy(topSeller.imagePublicId);
      } catch (error) {
        console.error('Error deleting image from Cloudinary:', error);
        // Continue with deletion even if image deletion fails
      }
    }
    
    await TopSeller.findByIdAndDelete(req.params.id);
    
    res.json({ 
      success: true, 
      message: 'Top seller deleted successfully' 
    });
  } catch (error) {
    console.error('Error deleting top seller:', error);
    res.status(500).json({ 
      success: false,
      error: 'Error deleting top seller' 
    });
  }
});

export default router;