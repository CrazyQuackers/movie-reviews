/** Review statistics of a movie. */
export interface RatingStats {
  /** Average rating rounded to 1 decimal, or null when the movie has no reviews. */
  averageRating: number | null;
  reviewCount: number;
}

/** Movie as returned by create and update. */
export interface MovieDto {
  id: string;
  title: string;
  releaseYear: number;
  genre: string[];
  director: string;
  actors: string[];
  description?: string;
  createdBy: string;
  createdAt: Date;
  updatedAt: Date;
}

/** Movie as returned by detail and list: the movie plus its review statistics. */
export interface MovieWithRatingsDto extends MovieDto, RatingStats {}
