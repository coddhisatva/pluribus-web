const createError = require('http-errors');
const express = require('express');
const expressLayouts = require('express-ejs-layouts');
const path = require('path');
const cookieParser = require('cookie-parser');
const cookieSession = require('cookie-session');
const logger = require('morgan');
const auth = require('./utils/auth');
const flash = require('./utils/flash');
const email = require('./utils/email');
const viewUtils = require('./utils/viewUtils');
const fs = require('fs');
const helpers = require('./utils/helpers');
const { startScheduler } = require('./utils/scheduler');
const credentials = require('./config/credentials');

var indexRouter = require('./routes/index');
var usersRouter = require('./routes/users');
var creatorsRouter = require('./routes/creators');
var supportersRouter = require('./routes/supporters');
var dashboardRouter = require('./routes/dashboard');
var adminRouter = require('./routes/admin');
var stripeRouter = require('./routes/stripe');
var guildsRouter = require('./routes/guilds');

var app = express();

// Add body parser middleware
app.use(express.json());

// view engine setup
app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'ejs');
app.use(expressLayouts);

if(app.get('env') == 'production') {
	app.set('trust proxy', true);
}

// We need to work around this to put Stripe js in the <head>
app.set('layout extractScripts', true);

app.use(logger('dev'));

app.use(express.static(path.join(__dirname, 'public')));

//app.use(express.json());
app.use(express.urlencoded({ extended: false }));

app.use(cookieSession({
	name: '_auth',
	secret: '!@)ktElMh;;SO2Fr)gCQdsc\'',
	maxAge: 14 * 24 * 60 * 60 * 1000, // 14 days
}));
app.use(flash);
app.use(auth.inject);
app.use(cookieParser());
app.use(viewUtils);

// Save posted values to view state
// Also include res, so we can do res.app.get('env')
app.use((req, res, next) => {
	res.locals.postedValues = req.body;
	res.locals.query = req.query;
	res.locals.req = req;
	next();
});

// Use different layouts for /dashboard and /admin
app.use((req, res, next) => {
	['dashboard', 'admin'].forEach(function(pathPrefix) {
		if(req.path.startsWith('/' + pathPrefix)) {
			res.locals.layout = pathPrefix + '/layout';
		}
	});
	next();
});

app.use('/', indexRouter);
app.use('/admin', adminRouter);
app.use('/users', usersRouter);
app.use('/creators', creatorsRouter);
app.use('/supporters', supportersRouter);
app.use('/dashboard', dashboardRouter);
app.use('/stripe', stripeRouter);
app.use('/guilds', guildsRouter);

// catch 404 
app.use(function(req, res, next) {
	//next(createError(404)); // (forward to error handler)
	res.locals.layout = 'layout';
	res.render('notfound');
});

// error handler
app.use(function(err, req, res, next) {
	let env = req.app.get('env');

	// set locals, view will only provide error in development
	res.locals.error = err;
	res.locals.env = env;

	// render the error page
	res.status(err.status || 500);
	res.render('error', { layout: false });
	
	if(err.status != 404 && env !== 'development') {
		// Email error to David
		try {
			var url = req.protocol + '://' + req.get('host') + req.originalUrl;
			var user = req.authUser ? req.authUser.email + '(' + req.authUser.id + ')' : 'anonymous';
			var errlog = err.stack;
			if(err.name && err.name == 'SequelizeDatabaseError') {
				try {
					errlog = 'Sequelize Error: ' + err.message + '\n' + 
					'SQL: ' + err.sql + '\n' + 
					'Parameters: ' + JSON.stringify(err.parameters) + '\n\n'
					+ errlog;
				} catch(e) {
					errlog = '(error setting Sequelize error log: ' + e + ')\n' + errlog;
				}
			}

			email.send(env, {
				from: 'errors@becomepluribus.com',
				to: 'pluribus-dev.prone832@passmail.net',
				subject: 'Pluribus Error',
				text: `${req.method} ${url}
User: ${user}
Client IP Address: ${req.ip}
Request body: ${JSON.stringify(req.body)}

${errlog}`
			});
		} catch(emailErr) { } // ignore
	}

	/*
	// Log to /logs/error.log
	const logDir = path.join(__dirname, 'logs');
	const logPath = path.join(logDir, 'error.log');
	if(!fs.existsSync(logDir)){
		fs.mkdirSync(logDir);
	}
	fs.appendFile(logPath, new Date().toISOString() + ": " + err.message + "\n" + err.stack + "\n\n", err => {
		if(err) {
			console.error(err);
		}
	});*/
});

app.locals.validationMessage = function(paramName) {
	var locals = this;
	if(locals.errors) {
		var errors = locals.errors;

		// Check whether the raw express-validator Result was used, and convert it to a mapped object if so
		if(errors.constructor.name == 'Result') {
			errors = errors.mapped();
		}

		if(errors[paramName]) {
			return '<div class="text-danger server-validation-error" for="' + paramName + '">' + errors[paramName].msg + '</div>';
		}
	}
}

app.locals.truncate = helpers.truncate;

if (process.env.NODE_ENV !== 'test') {
	startScheduler();
}

module.exports = app;
