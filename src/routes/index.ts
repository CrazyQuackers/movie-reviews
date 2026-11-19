import { Router } from 'express';
import authRouter from './auth';

const router = Router();

/**
 * @openapi
 * /health:
 *   get:
 *     summary: Health check
 *     responses:
 *       200:
 *         description: Service is up
 */
router.get('/health', (_req, res) => {
  res.json({ status: 'ok' });
});

// Mount feature routers below (one line each, to avoid merge conflicts):
router.use('/auth', authRouter);
// router.use('/movies', movieRouter);
// router.use('/reviews', reviewRouter);

export default router;
