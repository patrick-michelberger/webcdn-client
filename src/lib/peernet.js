var EventEmitter = require('events').EventEmitter;
var inherits = require('util').inherits;
var Peer = require('./peer.js');

module.exports = Peernet;
inherits(Peernet, EventEmitter);

function Peernet(options) {
    if (!options || !options.signalChannel) {
        throw new Error('Please specify a signalChannel {"signalChannel": signalChannel}');
        return;
    }
    var self = this;
    EventEmitter.call(this);
    this._peers = {};
    this._options = options;
    this._stunUrl = options.stunUrl || "stun:stun.l.google.com:19302";
    this._signalChannel = options.signalChannel;
    this._signalChannel.on('relay', function(data) {
        self._handleRelayMessage(data);
    });
};

Peernet.prototype.createConnection = function(peerId) {
    if (!this._peers[peerId]) {
        this._peers[peerId] = new Peer(peerId, this._signalChannel, this._stunUrl);
    }
    return this._peers[peerId];
};

Peernet.prototype._handleRelayMessage = function(data) {
    var msg = data;
    var started = true;
    if (msg && msg.data && msg.data.type === 'offer') {
        // logger.trace("offer from: ", data.from);
        var peer = this.createConnection(data.from);
        peer._pc.setRemoteDescription(new RTCSessionDescription(msg.data));
        peer.doAnswer();
    } else if (msg && msg.data && msg.data.type === 'answer' && started) {
        // logger.trace("answer from: ", data.from);
        var peer = this.createConnection(data.from);
        peer._pc.setRemoteDescription(new RTCSessionDescription(msg.data));
    } else if (msg && msg.data && msg.data.type === 'candidate' && started) {
        // logger.trace("candidate from: ", data.from);
        var candidate = new RTCIceCandidate({
            candidate: msg.data.candidate
        });
        var peer = this.createConnection(data.from);
        peer._pc.addIceCandidate(candidate);
    } else if (msg && msg.data && msg.data.type === 'bye') {
        // TODO onRemoteHangup();
        logger.trace('Hangup');
    }
};
