//jscs:disable
/*jshint laxcomma:true, node:true */
"use strict";

var readline = require('readline-sync')
	, http = require('http')
	, path = require('path')
	, fs = require('fs-promised')
	, D = require('d.js')
	, rootdir = path.normalize(__dirname + '/..')
	, adapterName
	, adapter
	, userConfigFile
	, seleniumReleaseUrl = "http://selenium-release.storage.googleapis.com/"
	, seleniumServerName
	, seleniumLatestVersion
	, seleniumLatestVersionPromise
	, downloads = []
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
	var args = downloads.shift(), argcb=args[2], next = function(){argcb && argcb(); doDownloads(cb);};
	args[2] = next;
	download.apply(null, args);
}

function queueDownload(url, dest, cb) {
	downloads.push(url, dest, cb);
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

// get a list of available adapters
function getFrameworkAdaptersListPromise(){
	return fs.readdirPromise('./adapters')
		.success(function(list){
			return list.filter(function(fileOrDirName){
				return fs.lstatSync('./adapters/' + fileOrDirName).isDirectory();
			});
		})
	;
}

process.chdir(__dirname);
//---------------------- CHECK LATEST SELENIUM VERSION ------------------------//
seleniumLatestVersionPromise = getLatestSeleniumUrlPromise();

//---------------------- WHICH FRAMEWORK TO USE AND LOAD CONFIG --------------//
configPromise = getFrameworkAdaptersListPromise()
	.success(function(adaptersNames){ // ask for adapter name
		do{
			adapterName = ask("Which adapter do you want to use ? (available adapters: " + adaptersNames.join(', ') + ")", "nightwatch");
		}while( !~adaptersNames.indexOf(adapterName) );
	})
	.success(function(){ // load adapter and adapter config
		adapter = require('./adapters/' + adapterName + '/' + adapterName +'.js');

		// check for user config
		userConfigFile = rootdir + '/' + adapter.configFileName;
		if ( fs.existsSync(userConfigFile)) {
			config = adapter.configLoader(rootdir + '/' + adapter.configFileName);
		} else {
			config = adapter.configLoader( rootdir + '/bin/adapters/' + adapterName + '/'+ adapter.configFileName);
		}
		return config;
	})
	.rethrow()
;

//---------------------- SELENIUM CONFIG --------------//
console.log("=== SELENIUM STANDALONE SERVER CONFIG ===");
D.all(seleniumLatestVersionPromise, configPromise)
	.spread(function(latestSeleniumUrl, config){
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
	})
;



console.log('what the fuck')
