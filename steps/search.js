module.exports.perform = function(searchTerm){
	return function (browser) {
		browser
			.setValue('input[type=text]', 'nightwatch')
			.waitForElementVisible('button[name=btnG]', 1000)
			.click('button[name=btnG]')
			.pause(1000)
		;
	}
};
