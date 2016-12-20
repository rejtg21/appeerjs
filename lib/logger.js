'use strict';

function logger() {
    var debug = false;

    return {
        setLogLevel: setLogLevel,
        log: log,
        error: error
    };

    function setLogLevel(newDebug) {
        debug = newDebug;
    }

    function log() {
        if (debug) {
            console.log.apply(console, arguments);
        }
    }

    function error() {
        if (debug) {
            console.error.apply(console, arguments);
        }
    }
}

module.exports = logger();
