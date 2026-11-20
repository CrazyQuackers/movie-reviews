/** Movie as returned by the API. */
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
