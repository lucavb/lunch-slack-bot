import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createActionToken, verifyActionToken } from './action-token';
import { ACTION_TOKEN_TTL_DAYS } from './constants';

const WEBHOOK_URL = 'https://hooks.slack.com/services/test/webhook/url';
const ACTION = 'confirm-lunch';
const LOCATION = 'Munich';
const DATE = '2026-10-12';

const createValidToken = (overrides?: {
    action?: string;
    location?: string;
    date?: string;
    ttlDays?: number;
}): string =>
    createActionToken(
        WEBHOOK_URL,
        overrides?.action ?? ACTION,
        overrides?.location ?? LOCATION,
        overrides?.date ?? DATE,
        overrides?.ttlDays ?? ACTION_TOKEN_TTL_DAYS,
    );

describe('action-token', () => {
    beforeEach(() => {
        vi.useRealTimers();
    });

    describe('createActionToken', () => {
        it('should produce the `${exp}.${signature}` token format', () => {
            const token = createValidToken();

            const dotIndex = token.indexOf('.');
            expect(dotIndex).toBeGreaterThan(0);

            const exp = Number.parseInt(token.slice(0, dotIndex), 10);
            const signature = token.slice(dotIndex + 1);

            expect(exp).toBeGreaterThan(Math.floor(Date.now() / 1000));
            expect(exp).toBeLessThanOrEqual(Math.floor(Date.now() / 1000) + 7 * 86400);
            expect(signature).toMatch(/^[0-9a-f]{64}$/);
        });
    });

    describe('verifyActionToken', () => {
        it('should accept a valid roundtripped token', () => {
            const token = createValidToken();

            expect(verifyActionToken(WEBHOOK_URL, ACTION, LOCATION, DATE, token)).toBe(true);
        });

        it('should reject a token tampered with a different action', () => {
            const token = createValidToken({ action: 'confirm-lunch' });

            expect(verifyActionToken(WEBHOOK_URL, 'opt-out-warnings', LOCATION, DATE, token)).toBe(false);
        });

        it('should reject a token tampered with a different location', () => {
            const token = createValidToken();

            expect(verifyActionToken(WEBHOOK_URL, ACTION, 'Berlin', DATE, token)).toBe(false);
        });

        it('should reject a token tampered with a different date', () => {
            const token = createValidToken();

            expect(verifyActionToken(WEBHOOK_URL, ACTION, LOCATION, '2026-10-19', token)).toBe(false);
        });

        it('should reject a token tampered with a modified expiry', () => {
            const token = createValidToken();
            const dotIndex = token.indexOf('.');
            const futureExp = Math.floor(Date.now() / 1000) + 90 * 86400;
            const tamperedToken = `${futureExp}.${token.slice(dotIndex + 1)}`;

            expect(verifyActionToken(WEBHOOK_URL, ACTION, LOCATION, DATE, tamperedToken)).toBe(false);
        });

        it('should reject an expired token', () => {
            const token = createValidToken({ ttlDays: -1 });

            expect(verifyActionToken(WEBHOOK_URL, ACTION, LOCATION, DATE, token)).toBe(false);
        });

        it('should reject a token without a signature separator', () => {
            expect(verifyActionToken(WEBHOOK_URL, ACTION, LOCATION, DATE, 'not-a-token')).toBe(false);
        });

        it('should reject a token created for a different webhook URL', () => {
            const token = createValidToken();

            expect(
                verifyActionToken('https://hooks.slack.com/services/other/webhook/url', ACTION, LOCATION, DATE, token),
            ).toBe(false);
        });
    });
});
