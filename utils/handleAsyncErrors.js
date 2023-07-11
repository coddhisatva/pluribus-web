// Because Express doesn't handle exceptions in async functions (unhandled promise rejections).
let wrap = handler => (...args) => handler(...args).catch(args[args.length-1]);

module.exports = {
	fixRouter: function(router) {
		['get','post','put'].forEach(method => {
			let protoMethod = router[method];
		
			router[method] = (...args) => {
				for(var i = 1; i < args.length; i++) {
					var arg = args[i];
					if(typeof arg === 'function' && arg[Symbol.toStringTag] === 'AsyncFunction') {
						args[i] = wrap(arg);
					}
				}
				return protoMethod.apply(router, args);
			}
		});
	}
}