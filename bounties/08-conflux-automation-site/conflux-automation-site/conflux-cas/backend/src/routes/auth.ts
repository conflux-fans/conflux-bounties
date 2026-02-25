import {
  type Request,
  type Response,
  Router,
  type Router as RouterType,
} from 'express';
import type { AuthPayload } from '../middleware/auth.js';
import { isAdminAddress, requireAuth, signToken } from '../middleware/auth.js';
import { authService } from '../services/auth-service.js';

type AuthRequest = Request & { user?: AuthPayload };

const router: RouterType = Router();

/** GET /auth/nonce?address=0x... — generate a SIWE nonce */
router.get('/nonce', async (req: Request, res: Response) => {
  const address = req.query.address as string;
  if (!address || !/^0x[0-9a-fA-F]{40}$/.test(address)) {
    res.status(400).json({ error: 'Invalid address' });
    return;
  }
  const nonce = await authService.generateNonce(address);
  res.json({ nonce });
});

/** POST /auth/verify — verify SIWE message and return JWT */
router.post('/verify', async (req: Request, res: Response) => {
  const { message, signature } = req.body;
  if (!message || !signature) {
    res.status(400).json({ error: 'message and signature required' });
    return;
  }
  try {
    const address = await authService.verifySiweMessage(message, signature);
    const token = signToken(address);
    res.json({ token, address });
  } catch (err: unknown) {
    res.status(401).json({ error: (err as Error).message });
  }
});

/** GET /auth/me — returns the caller's address and whether they are an admin */
router.get('/me', requireAuth, (req: Request, res: Response) => {
  const user = (req as AuthRequest).user!;
  res.json({ address: user.address, isAdmin: isAdminAddress(user.address) });
});

export default router;
