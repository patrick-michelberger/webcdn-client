var EventEmitter = require('events').EventEmitter;
var inherits = require('util').inherits;
var Peer = require('./peer.js');
var getBrowserRTC = require('get-browser-rtc');

module.exports = Peernet;
inherits(Peernet, EventEmitter);

/**
 * Factory for creating {@link Peer} instances 
 * @param options 
 * @param {Object} options.signalChannel - websocket connection for WebRTC signaling channel
 * @constructor 
 */
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

/** 
 * Create a peer connection with given peer id for a given resource hash value. 
 * @param {String} peerId - unique peer id  
 * @param {String} hash - unique resource hash value
 * @return {Peer}
 */
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
        //console.log("offer from: ", msg.from);
        var peer = this.createConnection(data.from);
        peer._otherSDP = msg.data;
        peer._pc.setRemoteDescription(new self._wrtc.RTCSessionDescription(msg.data));
        console.log("handle 'offer': this_otherCandidates: ", peer._otherCandidates);
        peer.doAnswer();
    } else if (msg && msg.data && msg.data.type === 'answer' && started) {
        //console.log("answer from: ", msg.from);
        var peer = this.createConnection(data.from);
        peer._otherSDP = msg.data;
        peer._pc.setRemoteDescription(new self._wrtc.RTCSessionDescription(msg.data));
        console.log("answer: ", peer._otherCandidates);
        for (var i = 0; i < peer._otherCandidates.length; i++) {
            if (peer._otherCandidates[i]) {
                console.log("handle 'answer': this_otherCandidates: ", peer._otherCandidates[i]);
                peer._pc.addIceCandidate(peer._otherCandidates[i]);
            }
        }
    } else if (msg && msg.data && msg.data.type === 'candidate' && started) {
        //console.log("candidate from: ", data.from);
        var candidate = new self._wrtc.RTCIceCandidate({
            candidate: msg.data.candidate
        });
        var peer = this._peers[data.from];
        peer.setIceCandidates(candidate);
    } else if (msg && msg.data && msg.data.type === 'bye') {
        // TODO onRemoteHangup();
        console.log('Hangup');
    }
};
