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
    EventEmitter.call(this);
    this._peers = {};
    this._options = options;
    this._stunUrl = options.stunUrl || "stun:stun.l.google.com:19302";
    this._signalChannel = options.signalChannel;
};

Peernet.prototype.createConnection = function(peerId) {
    var peer = new Peer(peerId, this._signalChannel, this._stunUrl);
    this._peers[peerId] = peer;
};
