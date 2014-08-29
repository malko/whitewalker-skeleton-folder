module.exports = {
	"go to goole" : "openGoogle"
	, "search nightwatch": require("../steps/search.js").perform("nightwatch")
	, "check results": function(browser){
		browser
			.assert.containsText('#main', 'The Night Watch')
			.end()
		;
	}
};
