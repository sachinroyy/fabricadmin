import mongoose from "mongoose";

const topSellerSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      trim: true,
      unique: true,
      maxlength: [50, 'Dress style name cannot exceed 50 characters']
    },
    description: {
      type: String,
    },
    price: {
      type: Number,
      min: [0, 'Price must be a positive number'],
      
      set: val => Math.round(val * 100) / 100 // Rounds to 2 decimal places
    },

    position: {
      type: Number,
      default: null,
      min: [0, 'Position must be a non-negative number']
    },
    image: {
      type: String,
      default: ''
    },
    imagePublicId: {
      type: String,
      default: ''
    },
    isActive: {
      type: Boolean,
      default: true
    }
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true }
  }
);

topSellerSchema.index({ name: 'text', description: 'text' });

export default mongoose.model("TopSeller", topSellerSchema);
