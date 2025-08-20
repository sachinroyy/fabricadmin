import express from "express";
import multer from "multer";
import path from 'path';
import fs from 'fs';
import DressStyle from "../models/dressstyle.js";
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
      cb(null, 'dressstyle-' + uniqueSuffix + path.extname(file.originalname));
    }
  }),
  limits: { 
    fileSize: 5 * 1024 * 1024, // 5MB limit
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

// GET all dress styles
router.get("/", async (req, res) => {
  try {
    const dressStyles = await DressStyle.find({});
    res.status(200).json(dressStyles);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// GET single dress style
router.get("/:id", async (req, res) => {
  try {
    const dressStyle = await DressStyle.findById(req.params.id);
    if (!dressStyle) {
      return res.status(404).json({ message: 'Dress style not found' });
    }
    res.status(200).json(dressStyle);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// POST create new dress style
router.post("/", upload.single('image'), async (req, res) => {
  try {
    const { name, description, price } = req.body;
    let imageUrl = '';
    let imagePublicId = '';

    // Check if dress style with same name already exists (case insensitive)
    const existingDressStyle = await DressStyle.findOne({ 
      name: { $regex: new RegExp(`^${name}$`, 'i') } 
    });
    
    if (existingDressStyle) {
      if (req.file) cleanupFile(req.file);
      return res.status(400).json({ 
        success: false,
        message: 'A dress style with this name already exists' 
      });
    }

    if (req.file) {
      try {
        // Upload to Cloudinary
        const result = await cloudinary.uploader.upload(req.file.path, {
          folder: 'dress-styles',
          resource_type: 'image'
        });
        imageUrl = result.secure_url;
        imagePublicId = result.public_id;
      } catch (uploadError) {
        cleanupFile(req.file);
        return res.status(500).json({ 
          success: false,
          message: 'Error uploading image to Cloudinary',
          error: uploadError.message 
        });
      }
    }

    const newDressStyle = new DressStyle({
      name,
      description,
      price: Number(price) || 0,
      image: imageUrl,
      imagePublicId
    });

    const savedDressStyle = await newDressStyle.save();
    
    // Clean up the uploaded file after successful save
    if (req.file) {
      cleanupFile(req.file);
    }

    res.status(201).json(savedDressStyle);
  } catch (error) {
    if (req.file) {
      cleanupFile(req.file);
    }
    res.status(400).json({ message: error.message });
  }
});

// PUT update dress style
router.put("/:id", upload.single('image'), async (req, res) => {
  try {
    const { name, description, price } = req.body;
    const updateData = { name, description };
    if (price !== undefined) {
      updateData.price = Number(price) || 0;
    }

    // Check if another dress style with the same name already exists
    if (name) {
      const existingDressStyle = await DressStyle.findOne({
        name: { $regex: new RegExp(`^${name}$`, 'i') },
        _id: { $ne: req.params.id } // Exclude current document
      });
      
      if (existingDressStyle) {
        if (req.file) cleanupFile(req.file);
        return res.status(400).json({ 
          success: false,
          message: 'Another dress style with this name already exists' 
        });
      }
    }

    const dressStyle = await DressStyle.findById(req.params.id);
    if (!dressStyle) {
      if (req.file) cleanupFile(req.file);
      return res.status(404).json({ 
        success: false,
        message: 'Dress style not found' 
      });
    }

    // Handle image update if new image is provided
    if (req.file) {
      try {
        // Delete old image from Cloudinary if exists
        if (dressStyle.imagePublicId) {
          await cloudinary.uploader.destroy(dressStyle.imagePublicId);
        }

        // Upload new image
        const result = await cloudinary.uploader.upload(req.file.path, {
          folder: 'dress-styles',
          resource_type: 'image'
        });
        
        updateData.image = result.secure_url;
        updateData.imagePublicId = result.public_id;
      } catch (uploadError) {
        cleanupFile(req.file);
        return res.status(500).json({ message: 'Error updating image in Cloudinary' });
      }
    }

    const updatedDressStyle = await DressStyle.findByIdAndUpdate(
      req.params.id,
      updateData,
      { new: true, runValidators: true }
    );

    // Clean up the uploaded file after successful update
    if (req.file) {
      cleanupFile(req.file);
    }

    res.status(200).json(updatedDressStyle);
  } catch (error) {
    if (req.file) {
      cleanupFile(req.file);
    }
    res.status(400).json({ message: error.message });
  }
});

// DELETE dress style
router.delete("/:id", async (req, res) => {
  try {
    const dressStyle = await DressStyle.findById(req.params.id);
    
    if (!dressStyle) {
      return res.status(404).json({ message: 'Dress style not found' });
    }

    // Delete image from Cloudinary if exists
    if (dressStyle.imagePublicId) {
      await cloudinary.uploader.destroy(dressStyle.imagePublicId);
    }

    await DressStyle.findByIdAndDelete(req.params.id);
    res.status(200).json({ message: 'Dress style deleted successfully' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

export default router;
