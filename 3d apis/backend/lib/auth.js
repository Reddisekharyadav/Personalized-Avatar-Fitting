import jwt from 'jsonwebtoken';

/**
 * JWT Authentication Middleware
 * Requirement H: authenticate all asset creation endpoints
 */

// Note: read JWT secret at runtime to avoid import order issues with dotenv

/**
 * Verify JWT token from cookies or Authorization header
 * @param {Request} req - Express request
 * @param {Response} res - Express response
 * @param {Function} next - Express next middleware
 */
export function authenticateJWT(req, res, next) {
  // Try to get token from cookie (httpOnly) or Authorization header
  let token = req.cookies?.token;
  
  if (!token) {
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
      token = authHeader.substring(7);
    }
  }

  if (!token) {
    return res.status(401).json({ error: 'Authentication required' });
  }

  try {
    const secret = process.env.JWT_SECRET;
    if (!secret) {
      console.error('JWT_SECRET not configured at verify time');
      return res.status(500).json({ error: 'Server auth is not configured' });
    }
    const decoded = jwt.verify(token, secret);
    req.user = decoded; // attach user info to request
    next();
  } catch (error) {
    console.error('JWT verification failed:', error.message);
    return res.status(403).json({ error: 'Invalid or expired token' });
  }
}

/**
 * Generate JWT token
 * @param {object} payload - token payload (e.g., { userId, email })
 * @param {string} expiresIn - expiration time (default 7d)
 * @returns {string} - JWT token
 */
export function generateToken(payload, expiresIn = '7d') {
  const secret = process.env.JWT_SECRET;
  if (!secret) {
    throw new Error('JWT_SECRET not configured');
  }
  return jwt.sign(payload, secret, { expiresIn });
}

export default {
  authenticateJWT,
  generateToken
};
