var EventEmitter = require('events').EventEmitter;
var inherits = require('util').inherits;

module.exports = Peer;
inherits(Peer, EventEmitter);

function Peer(id, signalChannel, stunUrl) {
    EventEmitter.call(this);
    this._id = id;
    this._stunUrl = stunUrl;
    this._pc = null;
    this._signalChannel = signalChannel
    this._reveiveChannel = null;
    this._sendChannel = null;
    this._imageData = null;
    this.init();
};

Peer.prototype.init = function() {
    var self = this;
    var label = "DC_LABEL_" + self._id;
    self._pc = self._createPeerConnection();
    self._pc.onicecandidate = function(event) {
        self._iceCallback.call(self, event);
    };
    self._pc.oniceconnectionstatechange = function(evt) {
        var connectionState = evt.target.iceConnectionState;
        if (connectionState === 'connected' || connectionState === 'completed') {
            // logger.trace("peerconnection status: connected");
        } else {
            // logger.trace("peerconnection status: closed");
        }
    };
    self._sendChannel = self._createDataChannel(self.pc, label);
};

Peer.prototype._createPeerConnection = function() {
    var servers = {
        iceServers: [{
            url: this._stunUrl
        }]
    };
    var constraints = {
        optional: []
    };

    var pc = new webkitRTCPeerConnection(servers, constraints);
    var name = "peerConnection_" + this._id;
    pc.onconnecting = this._createEventHandler(name + " onconnecting");
    pc.onopen = this._createEventHandler(name + " onopen");
    pc.onaddstream = this._createEventHandler(name + " onaddstream");
    pc.onremovestream = this._createEventHandler(name + " onremovestream");
    pc.ondatachannel = this._gotReceiveChannel;
    return pc;
};

Peer.prototype._createDataChannel = function(pc, label) {
    var self = this;
    var constrains = {
        reliable: false
    };
    var dc = self._pc.createDataChannel(label, constrains);
    var name = "dataChannel";
    dc.onclose = function() {
        logger.trace("dataChannel close");
        self._createEventHandler(name + " onclose");
    };
    dc.onerror = self._createEventHandler(name + " onerror");
    dc.onmessage = self._handleMessage;
    dc.onopen = function() {
        logger.trace("dataChannel: ", "OPEN");
    };
    return dc;
};

Peer.prototype._gotReceiveChannel = function(event) {
    var self = this;
    this._receiveChannel = event.channel;
    this._receiveChannel.onmessage = self._handleMessage;
    this._receiveChannel.onopen = self._handleReceiveChannelStateChange;
    this._receiveChannel.onclose = self._handleReceiveChannelStateChange;
};

Peer.prototype._handleMessage = function(event) {
    if (event.data == "\n") {
        // TODO endimage.src = imageData;
        logger.trace("Received all data. Setting image.");
    } else {
        this._imageData += event.data;
        logger.trace("Data chunk received");
    }
};

Peer.prototype._relay = function(data) {
    this._signalChannel.send('relay', data, this._id);
};

Peer.prototype.doOffer = function() {
    var self = this;
    var mediaConstraints = {
        optional: [{
            RtpDataChannels: true
        }]
    };
    self._pc.createOffer(function(sessionDescription) {
        self._setLocalAndSendMessage.call(self, sessionDescription);
    }, null, mediaConstraints);
};

Peer.prototype.doAnswer = function() {
    var self = this;
    var mediaConstraints = {
        optional: [{
            RtpDataChannels: true
        }]
    };
    self._pc.createAnswer(function(sessionDescription) {
        self._setLocalAndSendMessage.call(self, sessionDescription);
    }, null, mediaConstraints);
};

Peer.prototype._setLocalAndSendMessage = function(sessionDescription) {
    this._pc.setLocalDescription(sessionDescription);
    this._relay.call(this, sessionDescription);
};

Peer.prototype._iceCallback = function(event) {
    if (event.candidate) {
        // logger.trace('Local ICE candidate: \n' + event.candidate.candidate);
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
    logger.trace('Receive channel state is: ' + readyState);
};

Peer.prototype._createEventHandler = function(name) {
    return function(evt) {
        logger.trace('' + name + ' Event ' + events.length, evt);
    };
};
