(function e(t,n,r){function s(o,u){if(!n[o]){if(!t[o]){var a=typeof require=="function"&&require;if(!u&&a)return a(o,!0);if(i)return i(o,!0);var f=new Error("Cannot find module '"+o+"'");throw f.code="MODULE_NOT_FOUND",f}var l=n[o]={exports:{}};t[o][0].call(l.exports,function(e){var n=t[o][1][e];return s(n?n:e)},l,l.exports,e,t,n,r)}return n[o].exports}var i=typeof require=="function"&&require;for(var o=0;o<r.length;o++)s(r[o]);return s})({1:[function(require,module,exports){
module.exports.RTCSessionDescription = window.RTCSessionDescription ||
    window.mozRTCSessionDescription;
module.exports.RTCPeerConnection = window.RTCPeerConnection ||
    window.mozRTCPeerConnection || window.webkitRTCPeerConnection;
module.exports.RTCIceCandidate = window.RTCIceCandidate ||
    window.mozRTCIceCandidate;

},{}],2:[function(require,module,exports){
'use strict';

var EventDispatcher = require('./eventdispatcher');
var MediaConnection = require('./mediaconnection');
var logger = require('./logger');

function Appeer(id, options) {
    if (! (this instanceof Appeer)) return new Appeer(id, options);

    var defaultConfig = {
        iceServers: [{
            'url': 'stun:stun.1.google.com:19302'
        }]
    };

    this.id = id || '';
    this.options = options || {};
    this.socket = null;

    this.options.config = options.config || defaultConfig;

    this.connections = {};
    this.rooms = {};
    this.pendingCalls = [];

    // Initialize the connection to socket.io server
    this._initSocketIo(options.host + ':' + options.port, options);
    logger.setLogLevel(this.options.debug);
}

// Inherit from EventDispatcher
Object.assign(Appeer.prototype, EventDispatcher.prototype);

Appeer.prototype._initSocketIo = function (host, options) {
    var self = this;

    options = options || {};
    options.secure = true; // Always use https
    // add & if there's query specified
    options.query = (options.query) ? options.query+'&' : '';
    options.query += 'customId=' + this.id;

    this.socket = io.connect(host, options);

    this.socket.on('message', function (message) {
        self._handleMessages(message);
    });

    this.socket.on('error', function (error) {
        self.emit('error', { error: error });
    });

    this.on('on-stream-added', function (event) {
        var stream = event.data.stream,
            pendingCallsLen = self.pendingCalls.length;

        // Store the stream, to be used for making offer in incoming-member message
        self.stream = stream;

        for (var i = 0; i < pendingCallsLen; i++) {
            var peerId = self.pendingCalls[i],
                connection = this.connections[peerId];

            if (! connection) continue;

            // Wrap around IIFE to preserve the variable connection's value
            (function (conn) {
                conn.localStream = stream;
                conn._makeOffer(connection.pc);
            })(connection);
        }
    });
};

// temporary subject to change
// Change the stream specified
Appeer.prototype.setStream = function(stream) {
    this.stream = stream;
}
// end

Appeer.prototype.call = function (id, stream, options) {
    var options = options || {};
    // Used for making offer in incoming-member message
    this.stream = stream;
    options.originator = true;
    options._stream = stream;

    // Proceed to a single call, if peerId is not a room
    if (! this.rooms[id]) {
        // Immediately create a connection to start the calling process
        this.connections[id] = new MediaConnection(id, this, options);
    } else {
        // Inform the server that someone wants to call a room
        this.socket.send({
            type: 'call',
            from: this.id,
            to: id
        });
    }
};

Appeer.prototype._handleMessages = function (message) {
    var from = message.id,
        payload = message.payload,
        type = message.type;

    switch (type) {
        case 'connect':
            this.emit('connection', { id: message.appeerId });
            break;
        case 'answer':
            this.connections[from].handleSdp(payload);
            break;
        case 'candidate':
            this.connections[from].handleCandidate(payload, from);
            break;
        case 'offer':
            logger.log('Setting remote description on offer from', from);

            var connection = new MediaConnection(from, this, {
                originator: false,
                _payload: message.payload
            });

            this.connections[from] = connection;
            this.emit('call', { call: connection });

            break;
        case 'joined-call':
            var room = message.room;
            logger.log('Joining call from', from, 'in room', room);
            // make a call to the joined user 
            var connection = new MediaConnection(from, this, {
                originator: true,
                _stream: this.stream
            });

            this.connections[from] = connection;
            this.rooms[room][from] = from.toString();
            if (! this.stream) {
                logger.log('Stream not yet available, adding pending call from', from);
                this.pendingCalls.push(from);
            }

            // this.socket.send({
            //     type: 'answer-call',
            //     to: room
            // });
            break;
        case 'incoming-call':
            var room = message.room;

            logger.log('Incoming call from', from, 'in room', room);
            this.rooms[room][from] = from.toString();

            this.socket.send({
                type: 'answer-call',
                to: room
            });

            break;
        case 'incoming-member':
            logger.log('Incoming member', from);
            var room = message.room,
                connection = new MediaConnection(from, this, {
                    originator: true,
                    _stream: this.stream
                });

            this.connections[from] = connection;
            this.rooms[room][from] = from.toString();

            if (! this.stream) {
                logger.log('Stream not yet available, adding pending call from', from);
                this.pendingCalls.push(from);
            }

            break;
        case 'close':
            this.emit('close', { id: from });
            break;
        default:
            var error = message.error;
            logger.error('Invalid message with type', type, 'from', from);
            logger.error('AppeerJS Error:', error);
            break;
    }
};


Appeer.prototype.join = function (room, cb) {
    if (! room) return;

    var self = this;
    this.room = room;

    this.socket.send({
        room: room,
        type: 'join'
    }, function (room) {
        logger.log('Successfully joined room:', room);
        self.rooms[room] = {};
        if (typeof cb === 'function') cb();
    });
};

Appeer.prototype.close = function (id) {
    if (! id) return;

    var connection = this.connections[id],
        room = this.rooms[id];

    if (connection) {
        // Close the single connection
        this.connections[id].close();
    } else if (room) {
        // Close multiple connection
        for (var member in room) {
            if (room.hasOwnProperty(member)) {
                this.connections[member].close(id);
                // TODO: Replace this line when reconnection feature is implemented
                delete this.connections[member];
            }
        }
    }
};

module.exports = Appeer;

},{"./eventdispatcher":3,"./logger":5,"./mediaconnection":6}],3:[function(require,module,exports){
/**
 * @author mrdoob / http://mrdoob.com/
 */

'use strict';

function EventDispatcher() {}

Object.assign(EventDispatcher.prototype, {

    addEventListener: function (type, listener) {
        if (this._listeners === undefined) this._listeners = {};

        var listeners = this._listeners;

        if (listeners[type] === undefined) {
            listeners[type] = [];
        }

        if (listeners[type].indexOf(listener) === - 1) {
            listeners[type].push(listener);
        }
    },

    hasEventListener: function (type, listener) {
        if (this._listeners === undefined) return false;

        var listeners = this._listeners;

        if (listeners[type] !== undefined && listeners[type].indexOf(listener) !== -1) {
            return true;
        }

        return false;
    },

    removeEventListener: function (type, listener) {
        if (this._listeners === undefined) return;

        var listeners = this._listeners;
        var listenerArray = listeners[ type ];

        if (listenerArray !== undefined) {
            var index = listenerArray.indexOf(listener);

            if (index !== -1) {
                listenerArray.splice(index, 1);
            }
        }
    },

    dispatchEvent: function (event) {
        if (this._listeners === undefined) return;

        var listeners = this._listeners;
        var listenerArray = listeners[event.type];

        if (listenerArray !== undefined) {
            event.target = this;

            var i = 0,
                array = [],
                length = listenerArray.length;

            for (i = 0; i < length; i++) {
                array[i] = listenerArray[i];
            }

            for (i = 0; i < length; i++) {
                array[i].call(this, event);
            }
        }
    },

    on: function (eventName, listener) {
        this.addEventListener(eventName, listener);
    },

    emit: function (eventName, data) {
        var event = {
            type: eventName,
            data: data
        };

        this.dispatchEvent(event);
    }

});

module.exports = EventDispatcher;

},{}],4:[function(require,module,exports){
window.Appeer = require('./appeer');
window.RTCPeerConnection = require('./adapter').RTCPeerConnection;
window.RTCSessionDescription = require('./adapter').RTCSessionDescription;
window.RTCIceCandidate = require('./adapter').RTCIceCandidate;

},{"./adapter":1,"./appeer":2}],5:[function(require,module,exports){
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

},{}],6:[function(require,module,exports){
'use strict';

var logger = require('./logger');

function MediaConnection(peerId, appeer, options) {
    if (! (this instanceof MediaConnection)) return new MediaConnection(peerId, appeer, options);

    this.options = options || {};

    this.peerId = peerId;
    this.appeer = appeer;
    this.socket = appeer.socket;
    this.localStream = options._stream;

    // Starts an RTC Connection
    this._startConnection();

    this.pc.onaddstream = this._handleAddStream.bind(appeer, peerId);
    this.pc.onicecandidate = this._handleIceCandidate.bind(this);
}

MediaConnection.prototype._startConnection = function () {
    this.pc = new RTCPeerConnection(this.appeer.options.config, {
        optional: [{ DtlsSrtpKeyAgreement: true }]
    });

    if (this.options.originator && this.localStream) {
        this._makeOffer(this.pc);
    } else if (this.options.originator === false) {
        this.handleSdp(this.options._payload);
    }
};

MediaConnection.prototype._makeOffer = function (pc) {
    var self = this;

    logger.log('Creating offer to', self.peerId);

    pc.addStream(this.localStream);
    pc.createOffer(function (offer) {
        logger.log('Setting local description on offer');
        pc.setLocalDescription(offer, function () {
            self.socket.send({
                type: 'offer',
                payload: offer,
                to: self.peerId
            });
        }, function (error) {
            logger.error('Error setting local description on offer', error);
        });
    }, function (error) {
        logger.error('Error on creating offer', error);
    });
};

MediaConnection.prototype.handleSdp = function (answer) {
    logger.log('Setting remote description on answer from', this.peerId);
    this.pc.setRemoteDescription(new RTCSessionDescription(answer));
};

MediaConnection.prototype._handleAddStream = function (peerId, event) {
    logger.log('Incoming remote media stream', event);
    this.emit('stream', { stream: event.stream, peerId: peerId });
};

MediaConnection.prototype._handleIceCandidate = function (event) {
    logger.log('On Ice Candidate:', this.peerId);

    if (event.candidate) {
        this.socket.emit('message', {
            type: 'candidate',
            payload: event.candidate,
            to: this.peerId
        });
    }
};

MediaConnection.prototype.answer = function (stream) {
    this.pc.addStream(stream);
    this._handleOffer(this.peerId);

    this.appeer.emit('on-stream-added', { stream: stream });
};

MediaConnection.prototype._handleOffer = function (peerId) {
    var pc = this.pc,
        socket = this.socket;

    logger.log('Creating answer to', peerId);

    pc.createAnswer(function (answer) {
        logger.log('Setting local description on answer');
        pc.setLocalDescription(answer, function () {
            socket.emit('message', {
                type: 'answer',
                payload: answer,
                to: peerId
            });
        }, function (error) {
            logger.error('Error setting local description on answer', error);
        });
    }, function (error) {
        logger.error('Error on create answer from offer', error);
    });
};

MediaConnection.prototype.handleCandidate = function (candidate) {
    logger.log('Adding ice candidate from', this.peerId);
    this.pc.addIceCandidate(new RTCIceCandidate(candidate));
};

MediaConnection.prototype.close = function (room) {
    var pc = this.pc;

    if (!! pc && pc.signalingState !== 'closed') {
        pc.close();
        pc = null;

        this.socket.send({
            type: 'close',
            to: this.peerId,
            room: room
        });
    }
};

module.exports = MediaConnection;

},{"./logger":5}]},{},[4]);