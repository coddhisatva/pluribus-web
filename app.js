const createError = require('http-errors');
const express = require('express');
const expressLayouts = require('express-ejs-layouts');
const path = require('path');
const cookieParser = require('cookie-parser');
const cookieSession = require('cookie-session');
const logger = require('morgan');
const auth = require('./utils/auth');
const flash = require('./utils/flash');
const viewUtils = require('./utils/viewUtils');

var indexRouter = require('./routes/index');
var usersRouter = require('./routes/users');
var creatorsRouter = require('./routes/creators');
var supportersRouter = require('./routes/supporters');
var dashboardRouter = require('./routes/dashboard');
var adminRouter = require('./routes/admin');

var app = express();

// view engine setup
app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'ejs');
app.use(expressLayouts);

// We need to work around this to put Stripe js in the <head>
app.set('layout extractScripts', true);

app.use(logger('dev'));

app.use(express.static(path.join(__dirname, 'public')));

app.use(express.json());
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

// catch 404 and forward to error handler
app.use(function(req, res, next) {
	next(createError(404));
});

// error handler
app.use(function(err, req, res, next) {
	// set locals, only providing error in development
	res.locals.message = err.message;
	res.locals.error = req.app.get('env') === 'development' ? err : {};

	// render the error page
	res.status(err.status || 500);
	res.render('error');
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
