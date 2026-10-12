import { createHash, createHmac, timingSafeEqual } from 'node:crypto';

const KEY_DERIVATION_PREFIX = 'lunch-bot-reply-auth:';

const deriveActionTokenKey = (webhookUrl: string): Buffer =>
    createHash('sha256').update(`${KEY_DERIVATION_PREFIX}${webhookUrl}`).digest();

const createTokenMessage = (action: string, location: string, date: string, exp: number): string =>
    `${action}|${location}|${date}|${exp}`;

/**
 * Creates a server-issued, short-lived HMAC token that authorizes a single
 * reply action against the /reply route. The HMAC key is derived from the
 * Slack webhook URL, so rotating the webhook rotates all outstanding tokens.
 * Token format: `${exp}.${hmacSha256Hex(action|location|date|exp)}`.
 */
export const createActionToken = (
    webhookUrl: string,
    action: string,
    location: string,
    date: string,
    ttlDays: number,
): string => {
    const exp = Math.floor(Date.now() / 1000) + ttlDays * 86400;
    const message = createTokenMessage(action, location, date, exp);
    const signature = createHmac('sha256', deriveActionTokenKey(webhookUrl)).update(message).digest('hex');
    return `${exp}.${signature}`;
};

/**
 * Verifies a token produced by {@link createActionToken} for the given
 * action/location/date binding. Uses a timing-safe string comparison and
 * rejects tokens whose expiry has passed.
 */
export const verifyActionToken = (
    webhookUrl: string,
    action: string,
    location: string,
    date: string,
    token: string,
): boolean => {
    const separatorIndex = token.indexOf('.');
    if (separatorIndex === -1) {
        return false;
    }

    const expPart = token.slice(0, separatorIndex);
    const receivedSignature = token.slice(separatorIndex + 1);

    const exp = Number.parseInt(expPart, 10);
    if (Number.isNaN(exp) || exp < Math.floor(Date.now() / 1000)) {
        return false;
    }

    const message = createTokenMessage(action, location, date, exp);
    const expectedSignature = createHmac('sha256', deriveActionTokenKey(webhookUrl)).update(message).digest('hex');

    const expectedBuffer = Buffer.from(expectedSignature, 'hex');
    const receivedBuffer = Buffer.from(receivedSignature, 'hex');
    if (expectedBuffer.length !== receivedBuffer.length) {
        return false;
    }

    return timingSafeEqual(expectedBuffer, receivedBuffer);
};
