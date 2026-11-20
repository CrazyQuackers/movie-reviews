import { model, Schema, type Types } from 'mongoose';

export interface IMovie {
  title: string;
  releaseYear: number;
  genre: string[];
  director: string;
  actors: string[];
  description?: string;
  createdBy: Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const movieSchema = new Schema<IMovie>(
  {
    title: { type: String, required: true, trim: true },
    releaseYear: { type: Number, required: true },
    genre: { type: [String], required: true },
    director: { type: String, required: true, trim: true },
    actors: { type: [String], default: [] },
    description: { type: String, trim: true },
    createdBy: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  },
  { timestamps: true },
);

export const Movie = model<IMovie>('Movie', movieSchema);
