var EventEmitter = require('events').EventEmitter;
var inherits = require('util').inherits;

module.exports = Messenger;
inherits(Messenger, EventEmitter);

function Messenger() {
    EventEmitter.call(this);
    this.socket = null;
};

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

Messenger.prototype.connect = function(coordinatorUrl, callback) {
    var self = this;
    if (self.socket) {
        console.log("Socket exist, init fail.");
        callback();
        return;
    }

    //socket = new WebSocket(coordinatorUrl + '?id=' + uuid);
    self.socket = new WebSocket(coordinatorUrl);

    self.socket.onclose = function(event) {
        console.log("WebSocket.onclose", event);
    };

    self.socket.onerror = function(event) {
        console.log("WebSocket.onerror", event);
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

Messenger.prototype.disconnect = function() {
    this.socket.close();
    this.socket = null;
};

Messenger.prototype._handleRelayMessage = function(data) {
    this.emit("relay", data);
};

Messenger.prototype._handleLookupResponse = function(peerId) {
    this.emit('lookup-response', peerId);
};
