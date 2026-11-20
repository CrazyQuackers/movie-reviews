import { idParamSchema } from '../../src/validators/common';
import { createMovieSchema, listMoviesQuerySchema, updateMovieSchema } from '../../src/validators/movie';

const valid = { title: 'The Matrix', releaseYear: 1999, genre: ['sci-fi'], director: 'Wachowski' };

describe('createMovieSchema', () => {
  it('accepts a valid movie and defaults actors to []', () => {
    const parsed = createMovieSchema.parse(valid);
    expect(parsed.actors).toEqual([]);
  });

  it.each([
    ['missing title', { ...valid, title: undefined }],
    ['empty title', { ...valid, title: '  ' }],
    ['year before 1888', { ...valid, releaseYear: 1887 }],
    ['year too far in the future', { ...valid, releaseYear: new Date().getFullYear() + 6 }],
    ['non-integer year', { ...valid, releaseYear: 1999.5 }],
    ['empty genre list', { ...valid, genre: [] }],
    ['missing director', { ...valid, director: undefined }],
  ])('rejects %s', (_name, body) => {
    expect(createMovieSchema.safeParse(body).success).toBe(false);
  });

  it('accepts a year up to current + 5', () => {
    expect(createMovieSchema.safeParse({ ...valid, releaseYear: new Date().getFullYear() + 5 }).success).toBe(true);
  });

  it('strips unknown fields such as createdBy', () => {
    const parsed = createMovieSchema.parse({ ...valid, createdBy: 'hacker' });
    expect(parsed).not.toHaveProperty('createdBy');
  });
});

describe('updateMovieSchema', () => {
  it('accepts a partial update', () => {
    expect(updateMovieSchema.parse({ title: 'New' })).toEqual({ title: 'New' });
  });

  it('rejects an empty update', () => {
    expect(updateMovieSchema.safeParse({}).success).toBe(false);
  });

  it('still validates the fields it is given', () => {
    expect(updateMovieSchema.safeParse({ releaseYear: 1800 }).success).toBe(false);
  });
});

describe('idParamSchema', () => {
  it('accepts an ObjectId and rejects anything else', () => {
    expect(idParamSchema.safeParse({ id: '507f1f77bcf86cd799439011' }).success).toBe(true);
    expect(idParamSchema.safeParse({ id: 'nope' }).success).toBe(false);
  });
});

describe('listMoviesQuerySchema', () => {
  it('defaults page and limit and leaves filters and sort unset', () => {
    expect(listMoviesQuerySchema.parse({})).toEqual({ page: 1, limit: 20 });
  });

  it('coerces numbers from query strings and trims text filters', () => {
    const parsed = listMoviesQuerySchema.parse({ year: '1999', page: '2', limit: '5', title: '  matrix ' });
    expect(parsed).toMatchObject({ year: 1999, page: 2, limit: 5, title: 'matrix' });
  });

  it.each(['title', '-title', 'releaseYear', '-releaseYear', 'createdAt', '-createdAt'])('accepts sort=%s', (sort) => {
    expect(listMoviesQuerySchema.safeParse({ sort }).success).toBe(true);
  });

  it.each([
    ['unknown sort', { sort: 'rating' }],
    ['non-numeric year', { year: 'abc' }],
    ['non-integer year', { year: '1999.5' }],
    ['empty title', { title: '' }],
    ['empty genre', { genre: '   ' }],
    ['limit above 100', { limit: '101' }],
  ])('rejects %s', (_name, query) => {
    expect(listMoviesQuerySchema.safeParse(query).success).toBe(false);
  });
});
