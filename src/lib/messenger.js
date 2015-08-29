var EventEmitter = require('events').EventEmitter;
var inherits = require('util').inherits;

module.exports = Messenger;
inherits(Messenger, EventEmitter);

/**
 * Wrapper for setting up and maintaining a websocket connection
 * @constructor 
 */
function Messenger(options) {
    EventEmitter.call(this);
    this.socket = null;
    this.logger = options.logger;
};

/** 
 * Connect to a given websocket server
 * @param {String} coordinatorUrl - URL for websocket server
 * @param {Callback} callback
 */
Messenger.prototype.connect = function(coordinatorUrl, callback) {
    var self = this;
    if (self.socket) {
        self.logger.trace("Socket exist, init fail.");
        callback();
        return;
    }

    self.socket = new WebSocket(coordinatorUrl);

    self.socket.onclose = function(event) {
       self.logger.trace("WebSocket.onclose", event);
    };

    self.socket.onerror = function(event) {
        self.logger.trace("WebSocket.onerror", event);
    };

    self.socket.onmessage = function(event) {
        var msg = JSON.parse(event.data);
        if (msg.type === "relay" && msg.data) {
            self._handleRelayMessage(msg);
        }
        if (msg.type === "lookup-response" && msg.data) {
            self._handleLookupResponse(msg.data);
        }
    };

    self.socket.onopen = function(event) {
        callback();
    };

};

/** 
 * Close current websocket connection
 */
Messenger.prototype.disconnect = function() {
    this.socket.close();
    this.socket = null;
};

/**
 * Send a message to a given peer via websocket connection
 * @param {String} type - message type 
 * @param {Object} data - message payload
 * @param {String} receiver - peerid for receiver 
 */
Messenger.prototype.send = function(type, data, receiver) {
    var msg = {
        type: type,
        data: data
    };
    if (receiver) {
        msg.to = receiver;
    }
    var s_msg = JSON.stringify(msg);
    this.socket.send(s_msg);
};

Messenger.prototype._handleRelayMessage = function(data) {
    this.emit("relay", data);
};

Messenger.prototype._handleLookupResponse = function(data) {
    this.emit('lookup-response:' + data.hash, data);
};