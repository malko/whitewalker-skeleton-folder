#!/bin/sh
cd "$(dirname $0)";
wget http://selenium-release.storage.googleapis.com/2.42/selenium-server-standalone-2.42.2.jar
wget http://chromedriver.storage.googleapis.com/2.10/chromedriver_linux64.zip && unzip chromedriver_linux64.zip
