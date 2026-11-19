import { betterAuth } from "better-auth";
import { customSession } from 'better-auth/plugins'
import { prismaAdapter } from "better-auth/adapters/prisma";
import { APIError } from "better-auth/api";
import prisma from "./prisma";
import { emailService, sendInBackground } from '../services/email';
import logger from './logger';

const RESET_PASSWORD_TOKEN_TTL_SECONDS = 60 * 60;
/** Strict per-IP limit on endpoints that send emails, to protect the Resend quota. */
const EMAIL_ENDPOINT_RATE_LIMIT = { window: 15 * 60, max: 3 };

export const auth = betterAuth({
    database: prismaAdapter(prisma, {
        provider: "postgresql",
    }),

    cookiePrefix: 'random-chat',

    advanced: {
        cookiePrefix: 'random-chat',
        defaultCookieAttributes: {
            sameSite: 'none',
            secure: true
        }
    },

    emailAndPassword: {
        enabled: true,
        requireEmailVerification: false,
        resetPasswordTokenExpiresIn: RESET_PASSWORD_TOKEN_TTL_SECONDS,
        revokeSessionsOnPasswordReset: true,
        sendResetPassword: async ({ user, url }) => {
            sendInBackground(
                emailService.sendPasswordResetEmail(user.email, url, RESET_PASSWORD_TOKEN_TTL_SECONDS / 60),
            );
        },
    },
    emailVerification: {
        sendVerificationEmail: async ({ user, url }) => {
            logger.debug('Verification URL generated', { email: user.email });
            sendInBackground(emailService.sendVerificationEmail(user.email, url));
        },
    },
    rateLimit: {
        customRules: {
            '/request-password-reset': EMAIL_ENDPOINT_RATE_LIMIT,
            '/send-verification-email': EMAIL_ENDPOINT_RATE_LIMIT,
        },
    },
    socialProviders: {
        google: {
            prompt: "select_account",
            clientId: process.env.GOOGLE_CLIENT_ID as string,
            clientSecret: process.env.GOOGLE_CLIENT_SECRET as string,
        },
        facebook: {
            prompt: "select_account",
            clientId: process.env.FACEBOOK_CLIENT_ID as string,
            clientSecret: process.env.FACEBOOK_CLIENT_SECRET as string,
        },
    },
    plugins: [
        customSession(async ({ user, session }) => {
            const userDoc = await prisma.user.findFirst({ where: { id: session.userId }, select: { username: true, role: true } });
            return {
                user: {
                    ...user,
                    isCompleteProfile: !!userDoc?.username,
                    username: userDoc?.username,
                    role: userDoc?.role
                },
                session
            }
        })
    ],
    databaseHooks: {
        user: {
            create: {
                before: async (user) => {
                    const { isFeatureEnabled, SETTING_KEYS } = await import('../services/setting.service');
                    const registrationEnabled = await isFeatureEnabled(SETTING_KEYS.REGISTRATION_ENABLED);
                    if (!registrationEnabled) {
                        const { ERROR_MESSAGES } = await import('./errorMessages');
                        // APIError keeps the code in the response; a plain Error becomes FAILED_TO_CREATE_USER.
                        throw new APIError('BAD_REQUEST', {
                            code: ERROR_MESSAGES.REGISTRATION_DISABLED,
                            message: ERROR_MESSAGES.REGISTRATION_DISABLED,
                        });
                    }
                    return { data: user };
                },
                after: async (user) => {
                    sendInBackground(emailService.sendWelcomeEmail(user.email, user.name));
                },
            }
        }
    },
    trustedOrigins: JSON.parse(process.env.ALLOWED_ORIGINS || '[]'),
});

