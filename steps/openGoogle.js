module.exports = function (browser) {
	browser
		.url("http://www.google.com")
		.waitForElementVisible('body', 1000)
	;
};
