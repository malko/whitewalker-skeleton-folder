"use strict";
var fs = require('fs-promised');
module.exports = {
	// how the configFileName should be named
	configFileName: 'nightwatch.json'
	// command line to launch with placeholders for selenium environment name, configPath and the testPath to execute
	, cmdTemplate: '{{runnerPath || nightwatch}} -e {{environment}} -c {{configPath}} -t {{testPath}}'
	// read config file and return formatted data for the
	, configLoader: function(cfgPath){
		var data = JSON.parse(fs.readFileSync(cfgPath, 'utf8'))
			, res = {
				selenium: {
					path: data.selenium.server_path || ''
					, host: data.selenium.host || '127.0.0.1'
					, port: data.selenium.port || 4444
				}
				, environments: data.test_settings || {}
				, adapter: data.whitewalker || {}
			}
		;

		if( data.selenium && data.selenium.cli_args){
			res.selenium.driversPath = data.selenium.cli_args;
		}
		return res;
	}
};
