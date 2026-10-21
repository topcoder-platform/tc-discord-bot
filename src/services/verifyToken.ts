import { auth, Principal } from 'tc-core-library-js';
import { Env } from './env';

const validator = auth.createValidator({ AUTH_SECRET: Env.authSecret, VALID_ISSUERS: Env.validIssuers });

/** Verified Topcoder member accepted for Discord account linking. */
export type VerifiedMember = Principal & { kind: 'user'; handle: string };

/**
 * Validate a Topcoder member token for Discord account linking through shared core.
 * @param token Raw token from the login callback; arrays/objects are rejected.
 * @returns A normalized member with a numeric ID and nonempty verified handle.
 * @throws Sanitized Error for invalid tokens, missing member claims, or service tokens.
 * Service credentials cannot be linked to a Discord member, regardless of scopes.
 */
export async function verifyToken(token: unknown): Promise<VerifiedMember> {
    try {
        if (typeof token !== 'string') {
            throw new Error('Invalid token');
        }
        const principal = await validator.verify(token);
        if (principal.kind !== 'user' || typeof principal.handle !== 'string' || !principal.handle.trim()) {
            throw new Error('Member required');
        }
        return principal as VerifiedMember;
    } catch {
        throw new Error('Invalid or expired member token');
    }
}
