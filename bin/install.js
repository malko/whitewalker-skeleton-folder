"use strict";
var readline = require('readline-sync')
	, http = require('http')
	, fs = require('fs')
	, os = require('os')
	, unzip = require("unzip")
	, path = require('path')
	, spawn = require('child_process').spawn
	, tmpdir = os.tmpdir()
	// , rl = readline.createInterface({
	// 	input: process.stdin,
	// 	output: process.stdout
	// })
	, seleniumServerUrl = "http://selenium-release.storage.googleapis.com/2.42/selenium-server-standalone-2.42.2.jar"
	, seleniumServerName = "selenium-server-standalone-2.42.2.jar"
	, chromedriverName
	, chromedriverpath
	, downloads = []
	, config
;

function download(url, dest, cb) {
	var file = fs.createWriteStream(dest);
	http.get(url, function(response) {
		response.pipe(file);
		response.on('data',function(){ process.stdout.write('.');});
		file.on('finish', function() {
			file.close(cb);
		});
	});
}

function exec(cmd, args){
	var cp = spawn(cmd, args);

	cp.stdout.on('data', function(data) {
		console.log(data);
	});
	cp.stderr.on('data', function(data) {
		console.error(data);
	});
	cp.on('close', function (code) {
		console.log('child process exited with code ' + code);
	});
}

function confirm(question, defaultNo){
	var res = readline.question(question + ' [' + (defaultNo?'y,N':'Y,n') +']: ');
	if(! res) {
		return ! defaultNo;
	}
	return res.match(/^\s*y/i) ? true : false;
}
function ask(question, dflt){
	var res = readline.question(question + (dflt? '[' + dflt + ']' : '') + '\n');
	return res ? res : dflt;
}

process.chdir(path.normalize(__dirname+'/..'));

// load config
if( fs.existsSync('nightwatch.json') ){
	config = JSON.parse(fs.readFileSync('nightwatch.json','utf8'));
} else if( fs.existsSync('nightwatch.default.json') ){
	config = JSON.parse(fs.readFileSync('nightwatch.json','utf8'));
}

console.log("Welcome to WhiteWalker, we are about to configure your testing environment");
console.log("=== SELENIUM STANDALONE SERVER CONFIG ===");
config.selenium.server_path = __dirname + 'selenium-server-standalone-2.42.2.jar';
if( confirm('do you have a selenium server installed ?', true) ){
	config.selenium.server_path = ask(
		"please enter absolute path to your selenium-server-standalone-xxxx.jar"
		, config.selenium.server_path
	);
} else if( confirm("Do you want me to download " + seleniumServerName + " for you ?") ){
	downloads.push([seleniumServerUrl, config.selenium.server_path]);
} else {
	config.selenium.host = ask("please enter your selenium server address", config.selenium.host);
}
config.selenium.port = ask("please enter your selenium server port", config.selenium.port);
console.log("=== SELENIUM DRIVERS CONFIG ===");
if( confirm("do you want run test on chrome ?") ){
	config.test_settings.chrome = {
		"desiredCapabilities": {
			"browserName": "chrome",
			"javascriptEnabled": true,
			"acceptSslCerts": true
		}
	};
	config.selenium.cli_args["webdriver.chrome.driver"] = path.normalize(__dirname + '/chromedriver' + (os.platform() === "linux" ? '' : '.exe'));
	chromedriverName = ( os.platform() === "linux"? "chromedriver_linux" + ( os.arch().match('64')?64:32 ) : "chromedriver_win32");
	chromedriverpath = path.normalize(tmpdir + '/chromedriver.zip');
	downloads.push([
		"http://chromedriver.storage.googleapis.com/2.10/" + chromedriverName + ".zip"
		, chromedriverpath
		, function(){
			fs.createReadStream(chromedriverpath).pipe(unzip.Extract({ path: __dirname }));
		}
	]);
}

if( confirm("do you want run test on phantomjs ?") ){
	process.chdir(__dirname);
	exec("npm",['install', 'phantomjs']);
	process.chdir(__dirname);
};




console.log(config)

return;
if(downloads.length){
	console.log("downloading necessary files");
	downloads.forEach(function(args){ download.apply(null, args);});
}
