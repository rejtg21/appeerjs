(function e(t,n,r){function s(o,u){if(!n[o]){if(!t[o]){var a=typeof require=="function"&&require;if(!u&&a)return a(o,!0);if(i)return i(o,!0);var f=new Error("Cannot find module '"+o+"'");throw f.code="MODULE_NOT_FOUND",f}var l=n[o]={exports:{}};t[o][0].call(l.exports,function(e){var n=t[o][1][e];return s(n?n:e)},l,l.exports,e,t,n,r)}return n[o].exports}var i=typeof require=="function"&&require;for(var o=0;o<r.length;o++)s(r[o]);return s})({1:[function(require,module,exports){
module.exports.RTCSessionDescription = window.RTCSessionDescription ||
	window.mozRTCSessionDescription;
module.exports.RTCPeerConnection = window.RTCPeerConnection ||
	window.mozRTCPeerConnection || window.webkitRTCPeerConnection;
module.exports.RTCIceCandidate = window.RTCIceCandidate ||
	window.mozRTCIceCandidate;

},{}],2:[function(require,module,exports){
'use strict';

function Appeer(id, config) {
    this.id = id || '';
    this.config = config || {};
    this.socket = null;
    this.remoteId = null;

    this.config.iceServers = [{
        'url': 'stun:stun.1.google.com:19302'
    }];

    // Connect to WebRTC
    this._pc = new RTCPeerConnection(config, {
        optional: [{ RtpDataChannels: true }]
    });

    // Listen for webrtc events
    this._pc.onaddstream = this._handleAddStream.bind(this);
    this._pc.onicecandidate = this._handleIceCandidate.bind(this);

    // Initialize the connection to socket.io server
    this._initSocketIo(config.host + ':' + config.port);
    this._handleMessages();
}

Appeer.prototype._initSocketIo = function (host, options) {
    var _self = this;

    options = options || {};
    options.secure = true; // Always use https
    options.query = 'customId=' + this.id;

    _self.socket = io.connect(host, options);

    _self.socket.on('error', function (error) {
        _self.emit('error', { error: error });
    });
};

Appeer.prototype._handleAddStream = function (event) {
    console.log('On add stream', event);
    this.emit('stream', { stream: event.stream });
};

Appeer.prototype._handleIceCandidate = function (event) {
    console.log('On Ice Candidate:', this.remoteId);

    if (event.candidate) {
        this.socket.emit('message', {
            type: 'candidate',
            candidate: event.candidate,
            id: this.remoteId
        });
    }
};

Appeer.prototype.call = function (remoteId, localStream) {
    var pc = this._pc,
        socket = this.socket;

    this.remoteId = remoteId;
    pc.addStream(localStream);

    pc.createOffer(function (offer) {
        console.log('Creating offer');
        socket.emit('message', {
            type: 'offer',
            offer: offer,
            id: remoteId
        });

        pc.setLocalDescription(offer);
    }, function (error) {
        console.log('Error on creating offer', error);
    });
};

Appeer.prototype._handleMessages = function () {
    var _self = this;

    _self.socket.on('handle-message', function (message) {
        console.log('Got message', message);

        switch (message.type) {
            case 'connect':
                _self.emit('connection', { id: message.id });
                break;
            case 'offer':
                console.log('Setting remote description on offer', message.offer);
                // Set the remote description immediately
                _self._pc.setRemoteDescription(new RTCSessionDescription(message.offer));
                _self.emit('call', message);
                break;
            case 'answer':
                _self._handleAnswer(message.answer);
                break;
            case 'candidate':
                _self._handleCandidate(message.candidate);
                break;
            default:
                console.log(message.error);
                break;
        }
    });
};

Appeer.prototype._handleOffer = function (id) {
    var pc = this._pc,
        socket = this.socket;

    pc.createAnswer(function (answer) {
        pc.setLocalDescription(answer);

        socket.emit('message', {
            type: 'answer',
            answer: answer,
            id: id
        });
    }, function (error) {
        console.log('Error on create answer from offer', error);
    });
};

Appeer.prototype._handleAnswer = function (answer) {
    console.log('Setting remote description on answer');
    this._pc.setRemoteDescription(new RTCSessionDescription(answer));
};

Appeer.prototype._handleCandidate = function (candidate) {
    console.log('Adding ice candidate', candidate);
    this._pc.addIceCandidate(new RTCIceCandidate(candidate));
};

Appeer.prototype.answer = function (call, stream) {
    this.remoteId = call.id;
    this._pc.addStream(stream);
    this._handleOffer(call.id);
};

Appeer.prototype.emit = function (eventName, data) {
    return window.dispatchEvent(new CustomEvent(eventName, { detail: data }));
};

Appeer.prototype.on = function (eventName, callback) {
    window.addEventListener(eventName, callback);
};

module.exports = Appeer;

},{}],3:[function(require,module,exports){
window.Appeer = require('./appeer');
window.RTCPeerConnection = require('./adapter').RTCPeerConnection;
window.RTCSessionDescription = require('./adapter').RTCSessionDescription;
window.RTCIceCandidate = require('./adapter').RTCIceCandidate;

},{"./adapter":1,"./appeer":2}]},{},[3]);
