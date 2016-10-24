'use strict';

function Appeer(config) {
    this.id = '';
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
    options = options || {};
    options.secure = true; // Always use https

    this.socket = io.connect(host, options);
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
                if (! _self.id) _self.id = message.id;
                _self.emit('connection', { id: _self.id });
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
