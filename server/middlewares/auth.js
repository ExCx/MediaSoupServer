require('dotenv').config();
const express = require('express');
const jwt = require('jsonwebtoken');
const passport = require('passport');
const JwtStrategy = require('passport-jwt').Strategy;
const ExtractJwt = require('passport-jwt').ExtractJwt;

const USER = { id: "1", username: "admin", password: process.env.ADMIN_PASS };

const options = {
    jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
    secretOrKey: process.env.JWT_SECRET
};

passport.use(new JwtStrategy(options, (jwt_payload, done) => {
    if (jwt_payload.username === USER.username)
        return done(null, USER);
    return done(null, false);
}));

const router = express.Router();

router.post('/login', (req, res) => {
    // Example login route
    if (req.body.username === USER.username && req.body.password === USER.password) {
        const token = jwt.sign({ username: USER.username, id: USER.id }, process.env.JWT_SECRET, { expiresIn: '1h' });
        return res.json({ token });
    }
    return res.status(401).send("Authentication failed");
});

// Middleware to protect routes
function authenticate(req, res, next) {
    passport.authenticate('jwt', { session: false }, (err, user) => {
        if (err || !user) {
            return res.status(401).send({ message: 'Unauthorized' });
        }
        req.user = user;
        next();
    })(req, res, next);
}

// Protected route
router.get('/protected', authenticate, (req, res) => {
    res.json({ message: 'Success! You are authorized.' });
});

module.exports = router;