#!/bin/sh
cd "$(dirname $0)";
/usr/bin/env npm install && /usr/bin/env node ./install.js;
