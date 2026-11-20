import { model, Schema, type Types } from 'mongoose';

export interface IReview {
  movie: Types.ObjectId;
  createdBy: Types.ObjectId;
  rating: number;
  text: string;
  createdAt: Date;
  updatedAt: Date;
}

const reviewSchema = new Schema<IReview>(
  {
    movie: { type: Schema.Types.ObjectId, ref: 'Movie', required: true },
    createdBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    rating: { type: Number, required: true, min: 1, max: 10, validate: Number.isInteger },
    text: { type: String, required: true, trim: true, maxlength: 2000 },
  },
  { timestamps: true },
);

// One review per user per movie. Also serves "reviews of a movie" lookups (movie is the prefix).
reviewSchema.index({ movie: 1, createdBy: 1 }, { unique: true });

export const Review = model<IReview>('Review', reviewSchema);
