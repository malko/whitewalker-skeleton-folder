# WhiteWalker skeleton

Whitewalker is a front-end server for the awesome [nightwatch](http://nightwatchjs.org/)

>Nightwatch.js is an easy to use Node.js based End-to-End (E2E) testing solution for browser based apps and websites.
>
>It uses the powerful Selenium WebDriver API to perform commands and assertions on DOM elements.

This is a skeleton folder to ease new testing environment creation.

## Installation steps
First be sure to get git and node installed and in your path.
Don't forget to have Java in your system path if you intended to launch selenium server through whitewalker.

### Unix

```
$ git clone git@oogit.oodrive.net:a.toinon/whitewalker-skeleton-folder.git && cd whitewalker-skeleton-folder && rm -rf .git && ./bin/install.sh
```
and follow instructions

### Windows

1- Retrieve whitewalker-skeleton-folder repo.
```
$ git clone git@oogit.oodrive.net:a.toinon/whitewalker-skeleton-folder.git
$ cd whitewalker-skeleton-folder
```
2- Remove whitewalker-skeleton-folder .git 
```
$ rm -rf .git 
```
3- Install
```
$ cd bin
$ npm install 
$ node install.js
```

#### Troubleshooting

If you get an ```Error: ENOENT, stat 'C:\Users\User\AppData\Roaming\npm'```, it's a known npm problem on Windows.
You should create a npm folder in the displayed path to fix the problem.