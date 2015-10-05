var EventEmitter = require('events').EventEmitter;
var inherits = require('util').inherits;
var Peer = require('./peer.js');
var getBrowserRTC = require('get-browser-rtc');
var Statistics = require('./statistics.js');

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

Peernet.prototype._send = function(peerid, data, callback) {
    var peer = this._createConnection(peerid, data.hash, true);
    peer.callbacks[data.hash] = callback;
    var dataChannel = peer.dataChannel;
    data = JSON.stringify(data);
    if (typeof(dataChannel) === 'undefined' || dataChannel === null || dataChannel.readyState === 'closing' || dataChannel.readyState === 'closed') {
        this._reset(peerid);
        return;
    }
    console.log("dataChannel.readyState: ", dataChannel.readyState);
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
            for (var i = 0; i < dataChannel.queued.length; i++) {
                dataChannel.send(dataChannel.queued[i]);
            }
        };
    }
};

/** 
 * Create a peer connection with given peer id for a given resource hash value. 
 * @param {String} peerid - unique peer id  
 * @param {String} hash - unique resource hash value
 * @param {Boolean} originator - indicates if peer originates the connection
 * @return {Peer}
 */
Peernet.prototype._createConnection = function(peerid, hash, originator) {
    var self = this;
    if (!this._peers[peerid]) {
        console.log("create new peer");
        // Create new peer
        this._peers[peerid] = new Peer({
            "id": peerid,
            "originator": originator,
            "signalChannel": this._signalChannel,
            "peernet": this,
            "logger": this._logger,
            "iceUrls": this._iceUrls,
            "wrtc": this._wrtc
        });
    } else {
        console.log("peer is already present ....");
        // Statistics.mark("pc_connect_end:" + peerid);
        //Statistics.PC_CONNECT_DURATION = Statistics.measureByType("pc_connect", peerid);
    }
    return this._peers[peerid];
};

Peernet.prototype._reset = function(peerid) {
    if (this._peers.hasOwnProperty(peerid)) {
        var peer = this._peers[peerid];
        peer.connection.close();
        delete this._peers[peerid];
    }
};

Peernet.prototype._handleRelayMessage = function(msg) {
    var self = this;
    var peer = this._createConnection(msg.from, false, false);
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
    callback(this.downloaded[hash]);
};
