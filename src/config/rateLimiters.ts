import rateLimit, { ipKeyGenerator } from 'express-rate-limit';
import { Request } from 'express';

type RateLimitHandler = ReturnType<typeof rateLimit>;

/**
 * The visitor's real IP. Render serves everything through Cloudflare, so
 * req.ip (with `trust proxy` 1) was a proxy address shared by many people:
 * they all drew from one bucket and the whole API returned 429 for everyone.
 * Cloudflare sets CF-Connecting-IP to the client's address and overwrites any
 * value a client sends, so it's safe to trust here; req.ip is the fallback
 * (local development, no Cloudflare in front).
 */
export const clientIp = (req: Request): string => {
    const cfIp = req.headers['cf-connecting-ip'];
    if (typeof cfIp === 'string' && cfIp.trim()) return cfIp.trim();
    return req.ip || 'unknown';
};

const keyGenerator = (req: Request) => {
    if (req.user?.id) return `user:${req.user.id}`;
    return ipKeyGenerator(clientIp(req));
};

export const generalLimiter: RateLimitHandler = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 200,
    standardHeaders: 'draft-7',
    legacyHeaders: false,
    message: {
        success: false,
        message: "Demasiadas peticiones, por favor intenta de nuevo más tarde."
    },
    keyGenerator,
});

export const authLimiter: RateLimitHandler = rateLimit({
    windowMs: 60 * 1000,
    max: 20,
    standardHeaders: 'draft-7',
    legacyHeaders: false,
    message: {
        success: false,
        message: "Demasiados intentos de autenticación, por favor intenta de nuevo en 15 minutos."
    },
    keyGenerator,
});

export const createRoomLimiter: RateLimitHandler = rateLimit({
    windowMs: 60 * 60 * 1000,
    max: 3,
    standardHeaders: 'draft-7',
    legacyHeaders: false,
    message: {
        success: false,
        message: "Has creado demasiadas salas. Intenta de nuevo en una hora."
    },
    keyGenerator,
});

export const profileUpdateLimiter: RateLimitHandler = rateLimit({
    windowMs: 60 * 1000,
    max: 20,
    standardHeaders: 'draft-7',
    legacyHeaders: false,
    message: {
        success: false,
        message: "Estás realizando demasiadas actualizaciones. Reduce el ritmo."
    },
    keyGenerator,
});

export const listLimiter: RateLimitHandler = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 800,
    standardHeaders: 'draft-7',
    legacyHeaders: false,
    message: {
        success: false,
        message: "Estás navegando demasiado rápido. Por favor, espera un momento."
    },
    keyGenerator,
});
