import type { Request, Response } from 'express';
import * as movieService from '../services/movieService';
import type { AuthRequest } from '../types/auth';
import type { CreateMovieInput, ListMoviesQuery, UpdateMovieInput } from '../validators/movie';

// req.body / req.query / req.params have already been parsed by the `validate` middleware on the route.

export async function create(req: Request, res: Response): Promise<void> {
  const { user } = req as AuthRequest;
  const movie = await movieService.create(user.id, req.body as CreateMovieInput);
  res.status(201).json(movie);
}

export async function list(req: Request, res: Response): Promise<void> {
  res.json(await movieService.list(req.query as unknown as ListMoviesQuery));
}

export async function getById(req: Request, res: Response): Promise<void> {
  res.json(await movieService.getById(req.params.id as string));
}

export async function update(req: Request, res: Response): Promise<void> {
  const { user } = req as AuthRequest;
  const movie = await movieService.update(req.params.id as string, user.id, req.body as UpdateMovieInput);
  res.json(movie);
}

export async function remove(req: Request, res: Response): Promise<void> {
  const { user } = req as AuthRequest;
  await movieService.remove(req.params.id as string, user.id);
  res.status(204).send();
}
