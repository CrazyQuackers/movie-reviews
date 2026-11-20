import { idParamSchema, paginationSchema } from '../../src/validators/common';
import {
  createReviewSchema,
  listReviewsQuerySchema,
  movieIdParamSchema,
  updateReviewSchema,
} from '../../src/validators/review';

const valid = { rating: 8, text: 'Great movie' };

describe('createReviewSchema', () => {
  it('accepts a valid review and trims the text', () => {
    expect(createReviewSchema.parse({ rating: 8, text: '  Great  ' })).toEqual({ rating: 8, text: 'Great' });
  });

  it.each([1, 10])('accepts the boundary rating %s', (rating) => {
    expect(createReviewSchema.safeParse({ ...valid, rating }).success).toBe(true);
  });

  it.each([
    ['rating 0', { ...valid, rating: 0 }],
    ['rating 11', { ...valid, rating: 11 }],
    ['fractional rating', { ...valid, rating: 7.5 }],
    ['string rating', { ...valid, rating: '8' }],
    ['missing rating', { text: 'x' }],
    ['missing text', { rating: 5 }],
    ['blank text', { ...valid, text: '   ' }],
    ['text over 2000 chars', { ...valid, text: 'a'.repeat(2001) }],
  ])('rejects %s', (_name, body) => {
    expect(createReviewSchema.safeParse(body).success).toBe(false);
  });

  it('accepts text of exactly 2000 chars', () => {
    expect(createReviewSchema.safeParse({ ...valid, text: 'a'.repeat(2000) }).success).toBe(true);
  });

  it('strips unknown fields such as createdBy and movie', () => {
    const parsed = createReviewSchema.parse({ ...valid, createdBy: 'hacker', movie: 'other' });
    expect(parsed).toEqual(valid);
  });
});

describe('updateReviewSchema', () => {
  it('accepts a partial update', () => {
    expect(updateReviewSchema.parse({ rating: 3 })).toEqual({ rating: 3 });
    expect(updateReviewSchema.parse({ text: 'Changed my mind' })).toEqual({ text: 'Changed my mind' });
  });

  it('rejects an empty update', () => {
    expect(updateReviewSchema.safeParse({}).success).toBe(false);
  });

  it('still validates the fields it is given', () => {
    expect(updateReviewSchema.safeParse({ rating: 11 }).success).toBe(false);
  });

  it('ignores fields that cannot be edited', () => {
    expect(updateReviewSchema.safeParse({ movie: '507f1f77bcf86cd799439011' }).success).toBe(false);
    expect(updateReviewSchema.parse({ rating: 4, movie: '507f1f77bcf86cd799439011' })).toEqual({ rating: 4 });
  });
});

describe('params and pagination schemas', () => {
  it('movieIdParamSchema accepts only an ObjectId', () => {
    expect(movieIdParamSchema.safeParse({ movieId: '507f1f77bcf86cd799439011' }).success).toBe(true);
    expect(movieIdParamSchema.safeParse({ movieId: 'nope' }).success).toBe(false);
  });

  it('idParamSchema (shared) accepts only an ObjectId', () => {
    expect(idParamSchema.safeParse({ id: '507f1f77bcf86cd799439011' }).success).toBe(true);
    expect(idParamSchema.safeParse({ id: 'nope' }).success).toBe(false);
  });

  it('paginationSchema defaults and coerces', () => {
    expect(paginationSchema.parse({})).toEqual({ page: 1, limit: 20 });
    expect(paginationSchema.parse({ page: '3', limit: '10' })).toEqual({ page: 3, limit: 10 });
    expect(paginationSchema.safeParse({ limit: '101' }).success).toBe(false);
  });

  it('listReviewsQuerySchema is plain pagination', () => {
    expect(listReviewsQuerySchema.parse({})).toEqual({ page: 1, limit: 20 });
  });
});
