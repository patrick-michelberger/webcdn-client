var EventEmitter = require('events').EventEmitter;
var inherits = require('util').inherits;
var Peer = require('./peer.js');
var getBrowserRTC = require('get-browser-rtc');

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
    this._wrtc = options.wrtc === false ? undefined : getBrowserRTC() ||  options.wrtc;
    this._stunUrl = options.stunUrl || "stun:stun.l.google.com:19302";
    this._signalChannel = options.signalChannel;
    this._signalChannel.on('relay', function(data) {
        self._handleRelayMessage.call(self, data);
    });
};

Peernet.prototype.createConnection = function(peerId, hash) {
    var self = this;
    if (!this._peers[peerId]) {
        var options = {
            "id": peerId,
            "hash": hash,
            "signalChannel": this._signalChannel,
            "stunUrl": this._stunUrl,
            "wrtc": this._wrtc
        };
        this._peers[peerId] = new Peer(options);
        this._peers[peerId].on('update', function(hash) {
            self._signalChannel.send('update', [hash]);
        });
        this._peers[peerId].on('upload_ratio', function(data) {
            self._signalChannel.send('upload_ratio', data);
        });
    } else {
        this._peers[peerId].addHash(hash);
    }
    return this._peers[peerId];
};

Peernet.prototype._handleRelayMessage = function(data) {
    var msg = data;
    var started = true;
    var self = this;
    if (msg && msg.data && msg.data.type === 'offer') {
        //logger.trace("offer from: ", msg.from);
        var peer = this.createConnection(data.from);
        peer._pc.setRemoteDescription(new self._wrtc.RTCSessionDescription(msg.data));
        peer.doAnswer();
    } else if (msg && msg.data && msg.data.type === 'answer' && started) {
        //logger.trace("answer from: ", msg.from);
        var peer = this.createConnection(data.from);
        peer._pc.setRemoteDescription(new self._wrtc.RTCSessionDescription(msg.data));
    } else if (msg && msg.data && msg.data.type === 'candidate' && started) {
        //logger.trace("candidate from: ", data.from);
        var candidate = new self._wrtc.RTCIceCandidate({
            candidate: msg.data.candidate
        });
        var peer = this.createConnection(data.from);
        peer._pc.addIceCandidate(candidate);
    } else if (msg && msg.data && msg.data.type === 'bye') {
        // TODO onRemoteHangup();
        logger.trace('Hangup');
    }
};
