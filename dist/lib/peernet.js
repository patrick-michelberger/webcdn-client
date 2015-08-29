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
    this.downloaded = {};
    this.pending = {};
    this._peers = {};
    this._options = options;
    this._wrtc = options.wrtc === false ? undefined : getBrowserRTC() ||  options.wrtc;
    this._iceUrls = options.iceUrls || [{
        url: "stun:stun.l.google.com:19302"
    }, {
        url: "stun:stun1.l.google.com:19302"
    }, {
        url: "stun:stun2.l.google.com:19302"
    }, {
        url: "stun:stun3.l.google.com:19302"
    }, {
        url: "stun:stun4.l.google.com:19302"
    }];
    this._signalChannel = options.signalChannel;
    this._signalChannel.on('relay', function(data) {
        self._handleRelayMessage.call(self, data);
    });
    this._logger = options.logger;
};

Peernet.prototype.fetch = function(peerid, hash, callback) {
    var data = {
        type: 'fetch',
        hash: hash
    };
    this._send(peerid, data, callback);
};

Peernet.prototype._send = function(peerId, data, callback) {
    var peer = this._createConnection(peerId, true);
    peer.callbacks[data.hash] = callback;
    var dataChannel = peer.dataChannel;
    data = JSON.stringify(data);
    if (typeof(dataChannel) === 'undefined' || dataChannel === null || dataChannel.readyState === 'closing' || dataChannel.readyState === 'closed') {
        // TODO this.reset(peer);
        return;
    }
    if (dataChannel.readyState === 'open') {
        dataChannel.send(data);
    } else if (dataChannel.readyState === 'connecting') {
        // queue data
        if (dataChannel.hasOwnProperty("queued")) {
            dataChannel.queued.push(data);
        } else {
            dataChannel.queued = [data];
        }
        dataChannel.onopen = function(event) {
            // Statistics.mark("pc_connect_end:" + self._id);
            for (var i = 0; i < dataChannel.queued.length; i++) {
                dataChannel.send(dataChannel.queued[i]);
            }
        };
    }
};

/** 
 * Create a peer connection with given peer id for a given resource hash value. 
 * @param {String} peerId - unique peer id  
 * @param {String} hash - unique resource hash value
 * @return {Peer}
 */
Peernet.prototype._createConnection = function(peerId, originator) {
    var self = this;
    if (!this._peers[peerId]) {
        // Create new peer
        this._peers[peerId] = new Peer({
            "id": peerId,
            "originator": originator,
            "signalChannel": this._signalChannel,
            "peernet": this,
            "logger": this._logger,
            "iceUrls": this._iceUrls,
            "wrtc": this._wrtc
        });
    }
    return this._peers[peerId];
};

Peernet.prototype._handleRelayMessage = function(msg) {
    var self = this;
    var peer = this._createConnection(msg.from, false);
    if (msg && msg.data && msg.data.sdp) {
        peer._otherSDP = msg.data;
        peer.connection.setRemoteDescription(new self._wrtc.RTCSessionDescription(msg.data), function() {
            // Answer offer 
            if (msg.data.type === 'offer') {
                peer.doAnswer();
            }
        });
    } else if (msg && msg.data && msg.data.candidate) {
        peer.setIceCandidates(msg.data.candidate);
    }
};

Peernet.prototype.finishDownload = function(hash, content, callback) {
    this.downloaded[hash] = content;
    delete this.pending[hash];
    this._update([{
        hash: hash,
        size: content.byteLength
    }]);
    callback(this.downloaded[hash]);
};

/**
 * Send a "update" message to inform the coordinator about stored items
 * @param {Array} hashes Content hashes computed by _getItemHash()
 * @private
 */
Peernet.prototype._update = function(hashes) {
    this._signalChannel.send('update', hashes);
};
