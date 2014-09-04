#!/bin/sh
cd "$(dirname $0)";
/usr/bin/env npm install && /usr/bin/env node ./install.js;
#get http://selenium-release.storage.googleapis.com/2.42/selenium-server-standalone-2.42.2.jar
#get http://chromedriver.storage.googleapis.com/2.10/chromedriver_linux64.zip && unzip chromedriver_linux64.zip
