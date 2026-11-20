import type { Request, Response } from 'express';
import * as reviewService from '../services/reviewService';
import type { AuthRequest } from '../types/auth';
import type { CreateReviewInput, ListReviewsQuery, UpdateReviewInput } from '../validators/review';

// req.body / req.query / req.params have already been parsed by the `validate` middleware on the route.

export async function create(req: Request, res: Response): Promise<void> {
  const { user } = req as AuthRequest;
  const review = await reviewService.create(req.params.movieId as string, user.id, req.body as CreateReviewInput);
  res.status(201).json(review);
}

export async function listForMovie(req: Request, res: Response): Promise<void> {
  res.json(await reviewService.listForMovie(req.params.movieId as string, req.query as unknown as ListReviewsQuery));
}

export async function getById(req: Request, res: Response): Promise<void> {
  res.json(await reviewService.getById(req.params.id as string));
}

export async function update(req: Request, res: Response): Promise<void> {
  const { user } = req as AuthRequest;
  res.json(await reviewService.update(req.params.id as string, user.id, req.body as UpdateReviewInput));
}

export async function remove(req: Request, res: Response): Promise<void> {
  const { user } = req as AuthRequest;
  await reviewService.remove(req.params.id as string, user.id);
  res.status(204).send();
}
