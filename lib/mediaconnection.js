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

    this.pc.onaddstream = this._handleAddStream.bind(appeer);
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

MediaConnection.prototype._handleAddStream = function (event) {
    logger.log('Incoming remote media stream', event);
    this.emit('stream', { stream: event.stream });
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
