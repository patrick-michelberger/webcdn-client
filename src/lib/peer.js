var EventEmitter = require('events').EventEmitter;
var inherits = require('util').inherits;
var Statistics = require('./statistics.js');

module.exports = Peer;
inherits(Peer, EventEmitter);

var i = 0;

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
    this.callbacks = {};
    this._id = options.id;
    this._wrtc = options.wrtc;
    this._hashes = [];
    this._iceUrls = options.iceUrls;
    this._pc = null;
    this._signalChannel = options.signalChannel;
    this._peernet = options.peernet;
    this._reveiveChannel = null;
    this._isConnected = false;
    this._sendChannel = null;
    this._otherCandidates = [];
    this._otherSDP = false;
    this._originator = options.originator;
    this.init();
};

/** 
 * Creates a RTCPeerConnection and a DataChannel with given peer.
 */
Peer.prototype.init = function() {
    this._pc = this._createPeerConnection();
    this._sendChannel = this._createDataChannel(this._pc, this._id);
};

/**
 * Add resource hash to peer hash array. Indicates peer is storing this given resource.
 * @param {String} hash - unique resource hash value
 */
Peer.prototype.addHash = function(hash) {
    if (hash) {
        this._hashes.push(hash);
    }
};

Peer.prototype._createPeerConnection = function() {
    var self = this;
    var servers = {
        iceServers: this._iceUrls
    };
    var constraints = {};
    var pc = new this._wrtc.RTCPeerConnection(servers, constraints);
    var name = "peerConnection_" + this._id;
    // General event handlers 
    pc.onconnecting = this._createEventHandler(name + " onconnecting");
    pc.onopen = this._createEventHandler(name + " onopen");
    pc.onaddstream = this._createEventHandler(name + " onaddstream");
    pc.onremovestream = this._createEventHandler(name + " onremovestream");
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
    return pc;
};

Peer.prototype._createDataChannel = function(pc, label) {
    var self = this;
    var constraints = {
        ordered: true
    };

    // Date channel handlers
    pc.ondatachannel = function(event) {
        self._gotReceiveChannel.call(self, event);
    };

    var dc = self._pc.createDataChannel(label, constraints);
    // Event handlers 
    dc.onclose = function() {
        console.log("dataChannel close");
    };
    dc.onerror = function(err) {
        console.log("dc.onerror: ", err);
    };
    dc.onmessage = function(event) {
        self._handleMessage.call(self, event);
    };
    return dc;
};

Peer.prototype._fetchObjects = function() {
    var self = this;
    self._hashes.forEach(function(hash) {
        self._fetch(hash);
    });
};

Peer.prototype._fetch = function(hash) {
    var msg = {
        type: 'fetch',
        hash: hash
    };
    var msg_string = JSON.stringify(msg);
    // Statistics.mark("fetch_start:" + hash);
    this._sendChannel.send(msg_string);
};

Peer.prototype._gotReceiveChannel = function(event) {
    var self = this;
    this._receiveChannel = event.channel;
    this._receiveChannel.onmessage = function(event) {
        self._handleMessage.call(self, event);
    };
    this._receiveChannel.onopen = function() {};
    this._receiveChannel.onclose = function() {};

};


/**
 * Handler for DataChannel messages
 * @function _handleMessage
 */
Peer.prototype._handleMessage = function(event) {
    var msg = unmarshal(event.data);
    var endimage = document.querySelector('[data-webcdn-hash="' + msg.hash + '"]');

    if (msg.type === 'fetch' && msg.hash) {
        // Request for resource from other peer
        this._sendImage(msg.hash);
    } else if (msg.data == "\n") {
        // End of received message 
        this.callbacks[msg.hash](this._peernet.pending[msg.hash][0]);
    } else if (msg.type === 'fetch-response') {
        // Response for resource request
        if (!this._peernet.pending[msg.hash]) {
            this._peernet.pending[msg.hash] = [msg.data]; // First chunk
        } else {
            this._peernet.pending[msg.hash].push(msg.data);
        }
    }
};

Peer.prototype._relay = function(data) {
    this._signalChannel.send('relay', data, this._id);
};

Peer.prototype.doOffer = function() {
    var self = this;
    var constraints = {};
    if (!self._isConnected) {
        self._isConnected = true;
        self._pc.createOffer(function(sessionDescription) {
            self._isConnected = true;
            self._setLocalAndSendMessage.call(self, sessionDescription);
        }, function(err) {
            self._isConnected = false;
            console.log("createOffer error", err);
        }, constraints);
    }
};

Peer.prototype.doAnswer = function() {
    var self = this;
    var constraints = {};
    self._pc.createAnswer(function(sessionDescription) {
        self._setLocalAndSendMessage.call(self, sessionDescription);
        for (var i = 0; i < self._otherCandidates.length; i++) {
            if (self._otherCandidates[i]) {
                console.log("Peer.doAnswer: this_otherCandidates: ", self._otherCandidates[i]);
                self._pc.addIceCandidate(self._otherCandidates[i]);
            }
        }
    }, function(err) {
        console.log("createAnswer error", err);
    }, constraints);
};

Peer.prototype.setIceCandidates = function(iceCandidate) {
    //if (!this._otherSDP) {
    //    this._otherCandidates.push(iceCandidate);
    //}
    //if (this._otherSDP && iceCandidate && iceCandidate.candidate && iceCandidate.candidate !== null) {
    this._pc.addIceCandidate(iceCandidate);
    //}
};

Peer.prototype._setLocalAndSendMessage = function(sessionDescription) {
    this._pc.setLocalDescription(sessionDescription);
    this._relay.call(this, sessionDescription);
};

Peer.prototype._iceCallback = function(event) {
    if (event.candidate) {
        // console.log('Local ICE candidate: \n' + event.candidate.candidate);
        var data = {
            type: 'candidate',
            label: event.candidate.sdpMLineIndex,
            id: event.candidate.sdpMid,
            candidate: event.candidate.candidate
        };
        this._relay.call(this, data);
    }
};

Peer.prototype._handleReceiveChannelStateChange = function() {
    var readyState = this._receiveChannel.readyState;
    console.log('Receive channel state is: ' + readyState);
};

Peer.prototype._createEventHandler = function(name) {
    return function(evt) {
        console.log('' + name + ' Event ' + events.length, evt);
    };
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
                if (self._sendChannel.bufferedAmount > 5 * chunkSize) {
                    console.log("bufferedAmount ist too high! Slow down...");
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
                self._sendChannel.send(marshal(msg));
                dataSent = slideEndIndex;

                // Create & send end mark
                if (dataSent + 1 >= downloadSize) {
                    console.log("All data chunks for " + hash + " have been sent to ", self._id);
                    var msg = {
                        type: "fetch-response",
                        hash: hash,
                        data: "\n"
                    };
                    self._sendChannel.send(JSON.stringify(msg));
                }
            }
        };
        sendAllData();
    }
};

// Helper functions
function marshalBuffer(buffer) {
    var binary = '';
    var bytes = new Uint8Array(buffer);
    var len = bytes.byteLength;
    for (var i = 0; i < len; i++) {
        binary += String.fromCharCode(bytes[i]);
    }
    return window.btoa(binary);
};

function unmarshalBuffer(base64) {
    var binaryString = window.atob(base64);
    var len = binaryString.length;
    var bytes = new Uint8Array(len);
    for (var i = 0; i < len; i++) {
        bytes[i] = binaryString.charCodeAt(i);
    }
    return bytes.buffer;
};

function marshal(message) {
    if (message.data instanceof ArrayBuffer) {
        message.data = marshalBuffer(message.data);
    }
    return JSON.stringify(message);
};

function unmarshal(data) {
    var message = JSON.parse(data);
    if (message.hasOwnProperty('data')) {
        if (message.data !== "\n") {
            message.data = unmarshalBuffer(message.data);
        }
    }
    return message;
};
