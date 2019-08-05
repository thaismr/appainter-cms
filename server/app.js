const express           =   require('express')
    , session           =   require('express-session')
    , redis             =   require('redis')
    , RedisStore        =   require('connect-redis')(session)
    , passport          =   require('passport')
    , pg                =   require('pg')
    , helmet            =   require('helmet')
    , bodyParser        =   require('body-parser')
    , nodemailer        =   require('nodemailer')
    , { postgraphile }  =   require('postgraphile')
    , { Strategy: LocalStrategy } = require('passport-local')


// define your passwords, etc. inside private/config.js
const config = require('../private/config');

// web server
const app = express();

// redis session store
const REDIS_HOST      = process.env.REDIS_HOST      || 'localhost'
    , REDIS_PORT      = process.env.REDIS_PORT      || config.REDIS_PORT
    , SESSION_KEY     = process.env.SESSION_KEY     || config.SESSION_KEY
    , SESSION_SECRET  = process.env.SESSION_SECRET  || config.SESSION_SECRET

const client = redis.createClient();
const store = new RedisStore({
      host              : REDIS_HOST
    , port              : REDIS_PORT
    , client            : client
    , ttl               : 2600
});

// app.set('trust proxy', 1)  // trust first proxy
app.use(session({
    secret            : SESSION_SECRET
  , key               : SESSION_KEY
  , resave            : true
  , saveUninitialized : true
  , store             : store
}));

// server middlewares
app.use(helmet());                // set safe headers
app.use(passport.initialize());
app.use(passport.session());
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: false }));

// mailing service
const SMTP_HOST     = process.env.SMTP_HOST    || config.SMTP_HOST
    , SMTP_PORT     = process.env.SMTP_PORT    || config.SMTP_PORT
    , SMTP_SECURE   = process.env.PRODUCTION   || false
    , SMTP_USER     = process.env.SMTP_USER    || config.SMTP_USER
    , SMTP_PASS     = process.env.SMTP_PASS    || config.SMTP_PASS

const transporter = nodemailer.createTransport({
    host    : SMTP_HOST
  , port    : SMTP_PORT
  , secure  : SMTP_SECURE // true for 465, false for other ports
  , auth    : {
        user  : SMTP_USER
      , pass  : SMTP_PASS
  }
});

// postgres connection
const AUTH_POSTGRES_URI      = process.env.AUTH_POSTGRES_URI      || config.AUTH_POSTGRES_URI
    , GRAPHQL_POSTGRES_URI   = process.env.GRAPHQL_POSTGRES_URI   || config.GRAPHQL_POSTGRES_URI
    , GRAPHQL_SCHEMA         = process.env.GRAPHQL_SCHEMA         || config.GRAPHQL_SCHEMA
    , PRIVATE_SCHEMA         = process.env.PRIVATE_SCHEMA         || config.PRIVATE_SCHEMA
    , GRAPHIQL               = !process.env.PRODUCTION            || true

const pgPool = new pg.Pool({
  connectionString  : AUTH_POSTGRES_URI
});

app.use(
  postgraphile(GRAPHQL_POSTGRES_URI, GRAPHQL_SCHEMA, {
      graphqlRoute    : '/graphql'
    , graphiql        : GRAPHIQL
    , enableCors      : true
    , enhanceGraphiql : true
    , ignoreIndexes   : true
    , pgSettings      : async req =>
        ({
            'jwt.claims.user_id'  : req.user && req.user.id
          //'http.url': `${req.url}`
        })
  })
);

// passport session setup
passport.serializeUser((user, done) => {
  done(null, user.id);
});

passport.deserializeUser(async(id, done) => {
  let error = null;
  let user;
    try {
      const {
        rows: [_user],
      } = await pgPool.query(
        `select users.* from ${GRAPHQL_SCHEMA}.users where users.id = $1`,
        [id]
      );
      user = _user || false;
    } catch (e) {
      error = e;
    } finally {
      done(error, user);
    }
});

// log user in
passport.use(new LocalStrategy({
    usernameField: 'email',
    passwordField: 'passwd'
  },
  async (username, password, done) => {
    let error = null;
    let user;
    try {
        const {
          rows: [_user],
        } = await pgPool.query(
          `select users.* from ${PRIVATE_SCHEMA}.login($1, $2) users where not (users is null)`,
          [username, password]
        );
        user = _user || null;
    } catch (e) {
      error = e;
    } finally {
      done(error, user);
    }
  }
));

app.post('/auth/login',
  passport.authenticate('local', { successRedirect : '/', failureRedirect: '/' }),
  function(req, res) {
    res.redirect('/');
});

app.post('/auth/register', async(req, res) => {
    let error = null;
    let user;
    let avatarUrl = 'https://localhost/images/blank.jpg';
    const { username, email, name, password } = req.body;

    // check if username already taken:
    try {
        const {
          rows: [_username],
        } = await pgPool.query(
          `select users.username from ${GRAPHQL_SCHEMA}.users where users.username = $1`,
          [username]
        );
        if (_username) throw new Error('Username already in use.');
    } catch (e) {
      throw new Error('Error checking for existing username.');
    }

    // check if email already registered:
    try {
        const {
          rows: [_email],
        } = await pgPool.query(
          `select user_emails.email from ${GRAPHQL_SCHEMA}.user_emails where user_emails.email = $1`,
          [email]
        );
        if (_email) throw new Error('Email already in use.');
    } catch (e) {
      throw new Error('Error checking for existing email.');
    }

    // register new user:
    try {
        const {
          rows: [_user],
        } = await pgPool.query(
          `select users.* from ${PRIVATE_SCHEMA}.really_create_user(
              username => $1,
              email => $2,
              email_is_verified => false,
              name => $3,
              avatar_url => $4,
              password => $5
            ) users where not (users is null)`,
            [username, email, name, avatarUrl, password]
        );
        user = _user || null;
    } catch (e) {
      throw new Error('Error creating new user.');
    }

    // send account activation email
    let mailOptions = {
        from      : SMTP_USER
      , to        : `${email}`
      , subject   : `New account created at ${req.url}`
      , html      : `<p>New account created for ${username} at ${req.url}.</p><p>Here is your activation token: </p>`
    };

    try {
      await transporter.sendMail(mailOptions);
    } catch (e) {
      throw new Error('Error sending activation email.');
    } finally {
      res.end('New user created. Please check your e-mail for first-login authentication token.');
    }
});



app.get('/', function(req, res){
  res.end('Hi.');
});

app.get('/account', ensureAuthenticated, function(req, res){
  res.end('Hi.');
});

app.get('/logout', function(req, res){
  req.logout();
  res.redirect('index.html');
});

function ensureAuthenticated(req, res, next) {
  if (req.isAuthenticated()) { return next(); }
  res.redirect('/login');
};

const webpackMiddleware = require('webpack-dev-middleware');
const webpack = require('webpack');
const webpackConfig = require('../webpack.config.js');
app.use(webpackMiddleware(webpack(webpackConfig)));

module.exports = app;
