/** Review as returned by the API. */
export interface ReviewDto {
  id: string;
  movie: string;
  createdBy: string;
  rating: number;
  text: string;
  createdAt: Date;
  updatedAt: Date;
}
