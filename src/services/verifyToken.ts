import jwt from 'jsonwebtoken';
import { Env } from './env';

/**
 * Verify is jwt token is TC valid token or fake
 * @param token The TC jwt to verify
 * @param callback function to invoke with result
 */
export function verifyToken(token: any, callback: any): void {
    jwt.verify(token, Env.token, (err, decoded) => {
        if (err) {
            callback(new Error('Failed to authenticate token.'));
        } else {
            // token verified - no error
            callback(undefined, decoded);
        }
    });
}
