import type { Request, Response } from 'express';
import * as authService from '../services/authService';
import type { LoginInput, RegisterInput } from '../validators/auth';

// req.body has already been parsed by the `validate` middleware on the route.

export async function register(req: Request, res: Response): Promise<void> {
  const result = await authService.register(req.body as RegisterInput);
  res.status(201).json(result);
}

export async function login(req: Request, res: Response): Promise<void> {
  const result = await authService.login(req.body as LoginInput);
  res.status(200).json(result);
}
