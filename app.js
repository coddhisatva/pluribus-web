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

var indexRouter = require('./routes/index');
var usersRouter = require('./routes/users');
var creatorsRouter = require('./routes/creators');
var supportersRouter = require('./routes/supporters');
var dashboardRouter = require('./routes/dashboard');
var adminRouter = require('./routes/admin');
var stripeRouter = require('./routes/stripe');

var app = express();

// view engine setup
app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'ejs');
app.use(expressLayouts);

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

// catch 404 and forward to error handler
app.use(function(req, res, next) {
	next(createError(404));
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
		// Email error to Luke
		try {
			var url = req.protocol + '://' + req.get('host') + req.originalUrl;
			var user = req.authUser ? req.authUser.email + '(' + req.authUser.id + ')' : 'anonymous';

			email.send(env, {
				from: 'errors@becomepluribus.com',
				to: 'luke@smalltech.com.au',
				subject: 'Pluribus Error',
				text: `${req.method} ${url}
User: ${user}
Client IP Address: ${req.ip}
Request body: ${JSON.stringify(req.body)}

${err.stack}`
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

module.exports = app;
