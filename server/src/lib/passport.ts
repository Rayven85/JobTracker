import passport from 'passport';
import { Strategy as GoogleStrategy } from 'passport-google-oauth20';
import { findOrCreateGoogleUser } from '../services/auth.service';

if (!process.env.GOOGLE_CLIENT_ID) throw new Error('GOOGLE_CLIENT_ID is required');
if (!process.env.GOOGLE_CLIENT_SECRET) throw new Error('GOOGLE_CLIENT_SECRET is required');

const PORT = process.env.PORT || 4000;
const CALLBACK_URL = `http://localhost:${PORT}/api/v1/auth/google/callback`;

passport.use(
  new GoogleStrategy(
    {
      clientID: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
      callbackURL: CALLBACK_URL,
    },
    async (_accessToken, _refreshToken, profile, done) => {
      try {
        const email = profile.emails?.[0]?.value;
        if (!email) return done(new Error('No email provided by Google'));

        const user = await findOrCreateGoogleUser(
          profile.id,
          email,
          profile.displayName,
          profile.photos?.[0]?.value
        );

        // Normalise to JWT payload shape — keeps req.user consistent across auth strategies
        done(null, { userId: user.id, email: user.email });
      } catch (err) {
        done(err as Error);
      }
    }
  )
);

export { passport };
