// hello.js - Initial function
/**
 * Greet a user
 * @param {string} name - User name
 * @returns {string} greeting
 */
function sayHello(name) {
	return `Hello, ${name}!`
}

/**
 * Calculate factorial
 * @param {number} n - Input number
 * @returns {number} factorial result
 */
function factorial(n) {
	if (n <= 1) return 1
	return n * factorial(n - 1)
}

module.exports = { sayHello, factorial }
