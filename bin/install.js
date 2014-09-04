"use strict";
var readline = require('readline-sync')
	, http = require('http')
	, fs = require('fs')
	, os = require('os')
	, unzip = require("unzip")
	, path = require('path')
	, spawn = require('child_process').spawn
	, progress = require('progress')
	, tmpdir = os.tmpdir()
	, rootdir = path.normalize(__dirname+'/..')
	, seleniumServerUrl = "http://selenium-release.storage.googleapis.com/2.42/selenium-server-standalone-2.42.2.jar"
	, seleniumServerName = "selenium-server-standalone-2.42.2.jar"
	, chromedriverName
	, chromedriverpath
	, downloads = []
	, execs = []
	, config
	, withScreenShots
;

function download(url, dest, cb) {
	var file = fs.createWriteStream(dest)
		, req = http.get(url, function(res) {
			var len = parseInt(res.headers['content-length'], 10)
				, bar = new progress('downloading ' + dest + ' [:bar] :percent :etas', {
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

function exec(cmd, args, cb){
	console.log("executing command: %s %s", cmd, args.join(' '));
	process.chdir(__dirname);
	var cp = spawn(cmd, args);
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

function driverConfig(name, withScreenShots, options){
	var key, dcfg = config.test_settings[name] = {
		"desiredCapabilities": {
			"browserName": name
			, "javascriptEnabled": true
			, "acceptSslCerts": true
		}
	};
	if( withScreenShots ){
		dcfg.screenshots = {
			"enabled" : true
			, "path" : "screenshots/" + name
		};
	}
	if( options ){
		for( key in options ){ dcfg[key] = options; }
	}
	return dcfg;
}

process.chdir(rootdir);

// load config
if( fs.existsSync('nightwatch.json') ){
	console.log('Reading initial config from nightwatch.json');
	config = JSON.parse(fs.readFileSync('nightwatch.json','utf8'));
} else if( fs.existsSync('nightwatch.default.json') ){
	console.log('Reading initial config from nightwatch.default.json');
	config = JSON.parse(fs.readFileSync('nightwatch.default.json','utf8'));
}

console.log("Welcome to WhiteWalker, we are about to configure your testing environment");

console.log("=== SELENIUM STANDALONE SERVER CONFIG ===");
config.selenium.server_path = path.normalize(__dirname + '/selenium-server-standalone-2.42.2.jar');
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
if( confirm("Do you want to run test on firefox") ){
	withScreenShots = confirm("Do you want screenshots ?", true);
	driverConfig('firefox', withScreenShots);
}

if( confirm("do you want run test on chrome ?") ){
	withScreenShots = confirm("Do you want screenshots ?", true);
	driverConfig('chrome', withScreenShots);
	config.selenium.cli_args["webdriver.chrome.driver"] = path.normalize(
		__dirname + '/chromedriver' + (os.platform() === "linux" ? '' : '.exe')
	);
	chromedriverName = ( os.platform() === "linux"? "chromedriver_linux" + ( os.arch().match('64')?64:32 ) : "chromedriver_win32");
	chromedriverpath = path.normalize(tmpdir + '/chromedriver.zip');
	downloads.push([
		"http://chromedriver.storage.googleapis.com/2.10/" + chromedriverName + ".zip"
		, chromedriverpath
		, function(){
			console.log('unpacking chrome driver\n');
			fs.createReadStream(chromedriverpath).pipe(unzip.Extract({ path: __dirname }));
		}
	]);
}

if( confirm("Do you want run test on phantomjs ?") ){
	withScreenShots = confirm("Do you want screenshots ?", true);
	driverConfig(
		'phantomjs'
		, withScreenShots
		, {"phantomjs.binary.path": path.normalize(__dirname + "node_modules/phantomjs/lib/phantom/bin/phantomjs")}
	);
	execs.push(["npm",['install', 'phantomjs']]);
}
console.log("=== NightWatch configuration confirm ===");
console.log(require('util').inspect(config,{depth:10}));
if( ! confirm("Do you want to save above config to nightwatch.json and run the install")){
	console.log("Aborting install on user cancel.");
	process.exit();
}


console.log("writing nightwatch.json");
fs.writeFileSync('nightwatch.json', JSON.stringify(config, undefined, '\t'));

execs.length ? doExecs(doDownloads) : doDownloads;
