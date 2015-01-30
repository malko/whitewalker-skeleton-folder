//jscs:disable
/*jshint laxcomma:true, node:true, expr:true*/
"use strict";

var readline = require('readline-sync')
	, http = require('http')
	, path = require('path')
	, os = require('os')
	, D = require('d.js')
	, fs = require('fs-promised')
	, unzip = require("unzip")
	, progress = require('progress')
	, spawn = require('child_process').spawn
	, rootdir = path.normalize(__dirname + '/..')
	, adapterUtils = require('./adapters/utils.js')
	, adapterName
	, adapterRunners = {
		whitewalker: rootdir + '/bin/node_modules/.bin/whitewalker'
		, protractor: rootdir + '/bin/node_modules/.bin/whitewalker'
	}
	, seleniumReleaseUrl = "http://selenium-release.storage.googleapis.com/"
	, seleniumServerName
	, seleniumLatestVersion
	, seleniumLatestVersionPromise
	, chromedriverReleaseUrl = "http://chromedriver.storage.googleapis.com/LATEST_RELEASE"
	, chromeDriverLatestVersionPromise
	, downloads = []
	, execs = []
	, npmCmd = os.platform() === 'win32' ? 'npm.cmd' : 'npm'
	, configPromise
	, config
;

//------------------- UTILITY METHODS ---------------------//

// ask a question to user in sync
function ask(question, dflt){
	var res = readline.question(question + (dflt? ' [' + dflt + ']' : '') + '\n');
	return res ? res : dflt;
}

// ask a yes/no question
function confirm(question, defaultNo){
	var res = readline.question(question + ' [' + (defaultNo?'y,N':'Y,n') +']\n');
	if(! res) {
		return ! defaultNo;
	}
	return res.match(/^\s*y/i) ? true : false;
}

function download(url, dest, cb) {
	var file = fs.createWriteStream(dest)
	, req = http.get(url, function(res) {
		var len = parseInt(res.headers['content-length'], 10)
		, bar = new progress('downloading ' + path.basename(dest) + ' [:bar] :percent :etas', {
			complete: '=',
			incomplete: ' ',
			width: 20,
			total: len
		})
		;
		res.pipe(file);
		res.on('data', function(chunk){
			bar.tick(chunk.length);
		});
		file.on('finish', function() {
			file.close();
			console.log('\n');
			cb();
		});
	})
	;
	req.on('error', function(err){
		console.log("Error downloading %s\n\t%s", dest, err.message || err);
	});
}

function doDownloads(cb){
	if( ! downloads.length){
		return cb && cb();
	}
	var args = downloads.shift(), argcb = args[2], next = function(){argcb && argcb(); doDownloads(cb);};
	args[2] = next;
	download.apply(null, args);
}

function queueDownload(url, dest, cb) {
	downloads.push([url, dest, cb]);
}


function exec(cmd, args, cb){
	var options;
	if(! (args instanceof Array) ){
		options = args;
		args = options.args || [];
	}
	console.log("executing command: %s %s", cmd, args.join(' '));
	process.chdir(__dirname);
	var cp = spawn(cmd, args, options);
	cp.stdout.on('data', function(data) {
		console.log(data.toString('utf8'));
	});
	cp.stderr.on('data', function(data) {
		console.error(data.toString('utf8'));
	});
	cp.on('close', function (code) {
		console.log('child process exited with code ' + code);
		cb && cb();
	});
	process.chdir(rootdir);
}
function doExecs(cb){
	if( ! execs.length){
		return cb && cb();
	}
	var args = execs.shift(), argcb=args[2], next = function(){argcb && argcb(); doExecs(cb);};
	args[2] = next;
	exec.apply(null, args);
}
function queueExecs(cmd, args, cb) {
	args || (args = []);
	execs.push(cb ? [cmd, args, cb] : [cmd, args]);
}



// return a promise of an url
function getUrlDataPromise(url){
	var defered = D();
	http.get(url, function(response){
		var body = '';
		response
			.on('data', function (chunk) { body += chunk; })
			.on('end', function () { defered.resolve(body); })
			.on('error', function (err){ defered.reject(err); })
		;
	});
	return defered.promise.rethrow();
}

// return a promise of selenium latest version url
function getLatestSeleniumUrlPromise(){
	console.log("Checking selenium latest version available online");
	return getUrlDataPromise(seleniumReleaseUrl)
		.success(function(body){
			var version="0";
			body.replace(/<key>\d+\.\d+\/selenium-server-standalone-(\d+\.\d+\.\d+)\.jar<\/key>/ig, function(m, fullversion){
				(fullversion > version) && (version = fullversion);
			});
			seleniumLatestVersion = version;
			seleniumServerName = "selenium-server-standalone-" + version + ".jar";
			return seleniumReleaseUrl + version.replace(/\.\d+$/,'') + '/' + seleniumServerName;
		})
	;
}

// return a promise of chrome driver latest version url
function getLatestChromeDriverUrlPromise(){
	console.log("Checking chrome driver latest version available online");
	var chromedriverName = ( os.platform() === "linux"? "chromedriver_linux" + ( os.arch().match('64')?64:32 ) : "chromedriver_win32");
	return getUrlDataPromise(chromedriverReleaseUrl)
		.success(function(body){
			return chromedriverReleaseUrl.replace(/LATEST_RELEASE$/,body) + '/' + chromedriverName + ".zip";
		})
	;
}


function driverConfig(config, name){
	var driver = config.environments[name] || {};
	driver.desiredCapabilities || (driver.desiredCapabilities = {});
	driver.desiredCapabilities.browserName = driver.desiredCapabilities.browserName || name ;
	if( ! ('javascriptEnabled' in driver.desiredCapabilities) ){
		driver.desiredCapabilities.javascriptEnabled =  true ;
	}
	if( ! ('acceptSslCerts' in driver.desiredCapabilities) ){
		driver.desiredCapabilities.acceptSslCerts =  true ;
	}
	config.environments[name] = driver;
}

process.chdir(__dirname);
//---------------------- CHECK LATESTS VERSIONS ------------------------//
seleniumLatestVersionPromise = getLatestSeleniumUrlPromise();
chromeDriverLatestVersionPromise = getLatestChromeDriverUrlPromise();

//---------------------- WHICH FRAMEWORK TO USE AND LOAD CONFIG --------------//
configPromise = D.resolved(adapterUtils.listAvailables())
	.success(function(adaptersNames){ // ask for adapter name
		do{
			adapterName = ask("Which adapter do you want to use ? (available adapters: " + adaptersNames.join(', ') + ")", "nightwatch");
		}while( !~adaptersNames.indexOf(adapterName) );
	})
	.success(function(){ // load adapter config

		// check for user config
		if ( adapterUtils.hasConfig(adapterName, rootdir) ) {
			config = adapterUtils.readConfig(adapterName, rootdir);
		} else {
			config = adapterUtils.getDefaultConfig(adapterName);
		}
		return config;
	})
	.rethrow()
;

//---------------------- SELENIUM CONFIG --------------//
D.all(seleniumLatestVersionPromise, configPromise, chromeDriverLatestVersionPromise)
	.spread(function(latestSeleniumUrl, userConfig, chromeDriverLatestVersion){

		console.log("=== SELENIUM STANDALONE SERVER CONFIG ===");
		var defaultSeleniumInstallPath = config.selenium.path || (rootdir + '/bin/' + seleniumServerName);
		//console.log(latestSeleniumUrl, config, seleniumLatestVersion, defaultSeleniumInstallPath);
		if( confirm("Do you want me to install a selenium standalone server for you ?") ) { // we need to install selenium
			// @TODO : would be nice to check both answered path is witeable and we're not overwriting existing file without confirmation
			config.selenium.path = ask("Where do you want me to install your selenium standalone server ?", defaultSeleniumInstallPath);
			config.selenium.host = '127.0.0.1';
			queueDownload(latestSeleniumUrl, config.selenium.path);
		} else if( confirm("Do you have a local selenium standalone server ?") ) { // we need to get local user selenium
			config.selenium.path = ask("What's your selenium standalone server path ?", defaultSeleniumInstallPath);
			config.selenium.host = '127.0.0.1';
		} else { // we need to get remote user selenium
			config.selenium.host = ask("What's your selenium standalone server host ?", defaultSeleniumInstallPath);
		}
		config.selenium.port = ask("Which port do you want to use for your selenium standalone server ?", config.selenium.port);


		console.log("=== SELENIUM DRIVERS CONFIG ===");
		if( confirm("Do you want to run test on Firefox ?") ) {
			driverConfig(config, 'firefox');
		} else {
			config.environments.firefox = null;
		}

		if(! confirm("Do you want to run test on Chrome ?") ){
			config.environments.chrome = null;
		} else {
			driverConfig(config, 'chrome');
			var chromeDriverDownloadPath = path.dirname(config.selenium.path) + '/chromedriver.zip'
				, chromeDriverName = 'chromedriver' + (os.platform() === "linux" ? '' : '.exe')
				, chromeDriverDirectory
				, chromeDriverPath
			;

			if( config.selenium.driversPath && config.selenium.driversPath['webdriver.chrome.driver']) {
				chromeDriverPath = config.selenium.driversPath['webdriver.chrome.driver'];
			} else {
				chromeDriverPath = path.dirname(config.selenium.path) + '/' + chromeDriverName;
			}

			if( confirm("Do you want me to install Chrome driver for you ?") ){
				chromeDriverDirectory = ask("Where do you want me to install your Chrome driver ?", path.dirname(chromeDriverPath));
				queueDownload(chromeDriverLatestVersion, chromeDriverDownloadPath, function(){
					fs.createReadStream(chromeDriverDownloadPath)
						.pipe(unzip.Extract({ path: chromeDriverDirectory }))
						.on('finish', function(){
							fs.readdir(__dirname,function(err, files){
								files.some(function(file){
									if( file.match(/chromedriver/) ){
										fs.chmod(__dirname + '/' + file, 511);
										return true;
									}
								}) && fs.unlink(chromeDriverDownloadPath);
							});
						})
					;
				});
				chromeDriverPath = chromeDriverDirectory + '/' + chromeDriverName;
			} else if( confirm("Do you have a local Chrome driver ?") ) {
				chromeDriverPath = ask("What's your chrome driver path ?", chromeDriverPath);
			}
			config.selenium.driversPath['webdriver.chrome.driver'] = chromeDriverPath;
		}

		if(! confirm("Do you want to run test on Phantomjs ?") ){
			config.environments.phantomjs = null;
		} else {
			driverConfig(config, 'phantomjs');
			config.selenium.driversPath["phantomjs.binary.path"] = path.normalize(
				__dirname + "/node_modules/phantomjs/lib/phantom/bin/phantomjs"
			);
			queueExecs(npmCmd,['install', 'phantomjs']);
		}


		console.log('=== WhiteWalker server install ===');
		if( confirm('Do you want to install a local whitewalker server ?\n(say yes unless you already have a globally installed whitewalker')){
			queueExecs('git', ['clone', 'https://github.com/malko/whitewalker']);
			queueExecs(npmCmd, {args: ['install'], cwd: 'whitewalker'});
			if( adapterRunners[adapterName] ){
				config.adapter || (config.adapter = {});
				config.adapter.runner = adapterRunners[adapterName];
			}
		}
		return config;
	})
	// display the config to the user for confirmation
	.success(function(config){
		console.log(JSON.stringify(adapterUtils.translateConfig(adapterName, config), null, 2));
		if( !confirm('Are you pleased with this configuration') ){
			throw Error('USER ABORT');
		}
		return config;
	})
	// write the config now that we have all needed informations
	.success(function(config){
		adapterUtils.writeConfig(adapterName, rootdir, config);
		// then launch downloads and exec commands
		doDownloads(doExecs);
	})
	.error(function(err){
		if( err.message === 'USER ABORT' ){
			console.log('Installation aborted on user request.');
		} else {
			throw err;
		}
	})
	.rethrow()
;
