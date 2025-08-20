import mongoose from "mongoose";

const dressStyleSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, 'Dress style name is required'],
      trim: true,
      unique: true,
      maxlength: [50, 'Dress style name cannot exceed 50 characters']
    },
    description: {
      type: String,
      required: [true, 'Description is required']
    },
    price: {
      type: Number,
      default: 0,
      min: [0, 'Price cannot be negative']
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

dressStyleSchema.index({ name: 'text', description: 'text' });

export default mongoose.model("DressStyle", dressStyleSchema);
