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
 * @param {String} options.stunUrl - URL for Session Traversal Utilities for NAT (STUN) server
 * @param {String} options.hash - unique hash value for given resource
 * @constructor 
 */
function Peer(options) {
    EventEmitter.call(this);
    this._id = options.id;
    this._wrtc = options.wrtc;
    this._hashes = [];
    if (options.hash) {
        this._hashes.push(options.hash);
    }
    this._stunUrl = options.stunUrl;
    this._pc = null;
    this._signalChannel = options.signalChannel;
    this._reveiveChannel = null;
    this._isConnected = false;
    this._sendChannel = null;
    this._imageData = {};
    this._otherCandidates = [];
    this._otherSDP = false;
    this.init();
};

/** 
 * Creates a RTCPeerConnection and a DataChannel with given peer.
 */
Peer.prototype.init = function() {
    var self = this;
    var label = self._id;
    self._pc = self._createPeerConnection();
    self._sendChannel = self._createDataChannel(self.pc, label);
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
        iceServers: [{
            url: this._stunUrl,
            urls: [this._stunUrl]
        }]
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
        self._iceCallback.call(self, event);
    };
    pc.oniceconnectionstatechange = function(evt) {
        var connectionState = evt.target.iceConnectionState;
        if (connectionState === 'connected' || connectionState === 'completed') {
            console.log("peerconnection status: connected");
        } else {
            console.log("peerconnection status: closed");
        }
    };
    // Date channel handlers
    pc.ondatachannel = function(event) {
        self._gotReceiveChannel.call(self, event);
    };
    return pc;
};

Peer.prototype._createDataChannel = function(pc, label) {
    var self = this;
    var constraints = {
        ordered: true
    };
    var dc = self._pc.createDataChannel(label, constraints);
    var name = "dataChannel";
    // Event handlers 
    dc.onclose = function() {
        console.log("dataChannel close");
        self._createEventHandler(name + " onclose");
    };
    dc.onerror = function(err) {
        console.log("dc.onerror: ", err);
    };
    dc.onmessage = function(event) {
        self._handleMessage.call(self, event);
    };
    dc.onopen = function() {
        console.log("WebRTC DataChannel", "OPEN");
        Statistics.mark("pc_connect_end:" + self._id);
        self._fetchObjects();
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
    Statistics.mark("fetch_start:" + hash);
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

Peer.prototype._handleMessage = function(event) {
    var msg = JSON.parse(event.data);
    var endimage = document.querySelector('[data-webcdn-hash="' + msg.hash + '"]');
    if (msg.type === 'fetch' && msg.hash) {
        console.log("Send image", msg.hash);
        this._sendImage(msg.hash);
    } else if (msg.data == "\n") {
        Statistics.mark("fetch_end:" + msg.hash);
        if (i == 2) {
            Statistics.measure();
        }
        i++;
        console.log("Image received", msg.hash);
        endimage.src = this._imageData[msg.hash];
        endimage.dataset.webcdnData = this._imageData[msg.hash];
        endimage.classList.add('webcdn-loaded');
        var base64 = this._imageData[msg.hash].replace('data:application/octet-stream;base64,', '');
        var base64_byte = base64.length * 6 / 8;
        delete this._imageData[msg.hash];
        this.emit('update', msg.hash);
        this.emit('upload_ratio', {
            "from": this._id,
            "to": event.target.label,
            "hash": msg.hash,
            "size": base64_byte
        });
    } else if (msg.type === 'fetch-response') {
        if (!this._imageData[msg.hash]) {
            this._imageData[msg.hash] = msg.data;
        } else {
            this._imageData[msg.hash] += msg.data;
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
    Statistics.mark("sendImage_start:" + hash);
    var self = this;
    var imageToShare = document.querySelector('[data-webcdn-hash="' + hash + '"]');
    var chunkSize = 16384; // 16 KB 
    var dataSent = 0;
    var data = imageToShare.dataset.webcdnData;

    var sendAllData = function() {
        while (dataSent < data.length) {
            var slideEndIndex = dataSent + chunkSize;
            if (slideEndIndex > data.length) {
                slideEndIndex = data.length;
            }

            if (self._sendChannel.bufferedAmount > 5 * chunkSize) {
                console.log("bufferedAmount ist too high! Slow down...");
                setTimeout(sendAllData, 250);
                return;
            }

            var msg = {
                type: "fetch-response",
                hash: hash,
                data: data.slice(dataSent, slideEndIndex)
            };

            self._sendChannel.send(JSON.stringify(msg));
            dataSent = slideEndIndex;
            if (dataSent + 1 >= data.length) {
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

    setTimeout(sendAllData, 0);
};
