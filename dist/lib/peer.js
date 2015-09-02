var EventEmitter = require('events').EventEmitter;
var inherits = require('util').inherits;
var bufferConcat = require('array-buffer-concat');
var Statistics = require('./statistics.js');
var Utils = require('./utils.js');

module.exports = Peer;
inherits(Peer, EventEmitter);

/**
 * Wrapper for setting up and maintaining peer connection with another peer
 * @param options 
 * @param {String} options.id - unique peerId
 * @param {Object} options.signalChannel - websocket connection for WebRTC signaling channel
 * @param {Object} options.wrtc - WebRTC implementation object
 * @param {Array} options.iceUrls - Array of URLs for Session Traversal Utilities for NAT (STUN) or TURN servers 
 * @param {String} options.hash - unique hash value for given resource
 * @constructor 
 */
function Peer(options) {
    EventEmitter.call(this);

    // Properties
    this.connection = null;
    this.dataChannel = null;
    this.callbacks = {};

    this._id = options.id;
    this._wrtc = options.wrtc;
    this._iceUrls = options.iceUrls;
    this._originator = options.originator ||  false;

    // Dependencis
    this._signalChannel = options.signalChannel;
    this._logger = options.logger;
    this._peernet = options.peernet;

    this.init();
};

/** 
 * Creates a RTCPeerConnection and a DataChannel with given peer.
 */
Peer.prototype.init = function() {
    this.connection = this._createPeerConnection();
    this.dataChannel = this._createDataChannel(this.connection, this._id);
};

Peer.prototype.doOffer = function() {
    var self = this;
    self.connection.createOffer(function(sessionDescription) {
        self._setLocalAndSendMessage.call(self, sessionDescription);
    }, self._logger.handleError);
};

Peer.prototype.doAnswer = function() {
    var self = this;
    self.connection.createAnswer(function(sessionDescription) {
        self._setLocalAndSendMessage.call(self, sessionDescription);
    }, self._logger.handleError);
};

Peer.prototype.setIceCandidates = function(candidate) {
    var iceCandidate = new this._wrtc.RTCIceCandidate({
        candidate: candidate
    });
    this.connection.addIceCandidate(iceCandidate);
};

Peer.prototype._createPeerConnection = function() {
    var self = this;
    var pc = new this._wrtc.RTCPeerConnection({
        iceServers: this._iceUrls
    });

    // ICE handlers
    pc.onicecandidate = function(event) {
        if (event.candidate && self._originator === true) {
            self._iceCallback.call(self, event);
        }
    };
    pc.onnegotiationneeded = function() {
        if (self._originator === true) {
            self.doOffer();
        }
    };

    // DateChannel creation handler (other peer)
    pc.ondatachannel = function(event) {
        event.channel.onmessage = function(event) {
            self._handleMessage.call(self, event);
        };
    };
    return pc;
};

Peer.prototype._createDataChannel = function(pc, label) {
    var self = this;
    var dc = self.connection.createDataChannel(label);
    dc.onmessage = function(event) {
        self._handleMessage.call(self, event);
    };
    return dc;
};

/**
 * Handler for DataChannel messages
 * @function _handleMessage
 */
Peer.prototype._handleMessage = function(event) {
    var msg = Utils.unmarshal(event.data);
    if (msg.type === 'fetch' && msg.hash) {
        // Request for resource from other peer
        this._sendImage(msg.hash);
    } else if (msg.data == "\n") {
        // End of received message 
        this._updateUploadRatio(msg.hash, this._peernet.pending[msg.hash].byteLength);
        this.callbacks[msg.hash](this._peernet.pending[msg.hash]);
    } else if (msg.type === 'fetch-response') {
        // Response for resource request
        if (!this._peernet.pending[msg.hash]) {
            this._peernet.pending[msg.hash] = msg.data; // First chunk
        } else {
            this._peernet.pending[msg.hash] = bufferConcat(this._peernet.pending[msg.hash], msg.data);
        }
    }
};

Peer.prototype._setLocalAndSendMessage = function(sessionDescription) {
    var self = this;
    self.connection.setLocalDescription(sessionDescription, function() {
        self._relay.call(self, sessionDescription);
    }, self._logger.handleError);
};

Peer.prototype._iceCallback = function(event) {
    var data = {
        type: 'candidate',
        label: event.candidate.sdpMLineIndex,
        id: event.candidate.sdpMid,
        candidate: event.candidate.candidate
    };
    this._relay.call(this, data);
};

Peer.prototype._sendImage = function(hash) {
    // Statistics.mark("sendImage_start:" + hash);
    var self = this;
    var chunkSize = 25 * 1024;
    var dataSent = 0;

    if (this._peernet.downloaded.hasOwnProperty(hash)) {
        var data = this._peernet.downloaded[hash];
        var downloadSize = data.byteLength;

        var sendAllData = function() {
            while (dataSent < downloadSize) {
                var slideEndIndex = dataSent + chunkSize;
                if (slideEndIndex > downloadSize) {
                    slideEndIndex = downloadSize;
                }

                // Slow down control
                if (self.dataChannel.bufferedAmount > 5 * chunkSize) {
                    self._logger.trace("bufferedAmount ist too high! Slow down...");
                    setTimeout(sendAllData, 250);
                    return;
                }

                // Create & send chunk 
                var chunk = data.slice(dataSent, slideEndIndex);
                var msg = {
                    type: "fetch-response",
                    hash: hash,
                    data: chunk
                };
                self.dataChannel.send(Utils.marshal(msg));
                dataSent = slideEndIndex;

                // Create & send end mark
                if (dataSent + 1 >= downloadSize) {
                    self._logger.trace("All data chunks for " + hash + " have been sent to " + self._id);
                    var msg = {
                        type: "fetch-response",
                        hash: hash,
                        data: "\n"
                    };
                    self.dataChannel.send(JSON.stringify(msg));
                }
            }
        };
        sendAllData();
    }
};

Peer.prototype._relay = function(data) {
    this._signalChannel.send('relay', data, this._id);
};

Peer.prototype._updateUploadRatio = function(hash, bytes)  {
    this._signalChannel.send('upload_ratio', {
        "from": window.webcdn_uuid,
        "to": this._id,
        "hash": hash,
        "size": bytes
    });
};