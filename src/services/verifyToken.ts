import jwt from 'jsonwebtoken';
import jwksRSA from 'jwks-rsa';

const jwksClients = {}; // in global scope

export function verifyToken(token: any, validIssuers: string[], callback: any): void {
    // Decode it first
    let decodedToken: any = jwt.decode(token, { complete: true });

    // Check if it's HS or RS

    if (decodedToken && decodedToken.header) {
        if (decodedToken.header.alg === 'RS256') {
            if (validIssuers.indexOf(decodedToken.payload.iss) === -1) {
                callback(new Error('Invalid token issuer.'));
            } else {
                // Get the key id (kid)
                let kid = decodedToken.header.kid;
                // Get the public cert for verification then verify
                if (!jwksClients[decodedToken.payload.iss]) {
                    jwksClients[decodedToken.payload.iss] = jwksRSA({
                        cache: true,
                        cacheMaxEntries: 5, // Default value
                        cacheMaxAge: 0, // undefined/0 means infinte
                        jwksUri: decodedToken.payload.iss + '.well-known/jwks.json',
                    });
                }
                jwksClients[decodedToken.payload.iss].getSigningKey(kid, (err, key) => {
                    if (err) {
                        callback(new Error('Invalid Token.' + err));
                    } else {
                        jwtVerify(token, key.publicKey, callback);
                    }
                });
            }
        }
    } else {
        callback(new Error('Invalid Token.'));
    }
};

const jwtVerify = (token, secretOrCert, callback) => {
    try {
        // verifies secret and checks exp
        jwt.verify(token, secretOrCert, (err, decoded) => {
            if (err) {
                callback(new Error('Failed to authenticate token.'));
            } else {
                // token verified - no error
                callback(undefined, decoded);
            }
        });
    } catch (e) {
        callback(new Error('Error in jwtVerify: ' + e.message));
    }
};