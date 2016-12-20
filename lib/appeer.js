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
    this._initSocketIo(options.host + ':' + options.port);
    logger.setLogLevel(this.options.debug);
}

// Inherit from EventDispatcher
Object.assign(Appeer.prototype, EventDispatcher.prototype);

Appeer.prototype._initSocketIo = function (host, options) {
    var self = this;

    options = options || {};
    options.secure = true; // Always use https
    options.query = 'customId=' + this.id;

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
