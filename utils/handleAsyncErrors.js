// Because Express doesn't handle exceptions in async functions (unhandled promise rejections).
module.exports = handler => (...args) => handler(...args).catch(args[args.length-1]);