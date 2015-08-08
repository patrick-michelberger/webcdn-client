module.exports = Statistics;

function Statistics(settings) {
    settings = settings || {};
    this._host = settings.host || "webcdn-mediator.herokuapp.com";
    this._httpPort = settings.httpPort || "80";
    this._wsPort = settings.wsPort ||  "1337";
    this._uuid = settings.uuid ||  false;
    this.init();
};

Statistics.prototype.init = function() {
    this.initWebsocket();
};

Statistics.prototype.initWebsocket = function() {
    var self = this,
        url = "ws://" + self._host + ':' + self._wsPort + "?id=" + self._uuid;

    if (self.socket) {
        logger.trace("Socket exist, init fail.");
        return;
    }

    self.socket = new WebSocket(url);
    self.socket.onclose = function(event) {
        console.log("WebSocket.onclose", event);
    };

    self.socket.onerror = function(event) {
        console.log("WebSocket.onerror", event);
    };

    self.socket.onmessage = function(event) {
        var msg = JSON.parse(event.data);
    };

    self.socket.onopen = function(event) {
        console.log("Websocket connection open to : ", self._host);
        self.addHost();
    };
};

Statistics.prototype.addHost = function() {
    var data = {
        "uuid": this._uuid,
        "active": true
    };
    if (window.performance && window.performance.timing) {
        data.performance = {};
        data.performance.timing = window.performance.timing.toJSON();
    }
    this.sendMessage("host:add", data);
};

Statistics.prototype.removeHost = function() {
    var data = {
        "uuid": this._uuid
    };
    this.sendMessage("host:remove", data);
};

Statistics.prototype.sendMessage = function(type, data) {
    var message = {
        type: type,
        data: data
    };
    this.socket.send(JSON.stringify(message));
};

Statistics.prototype.getHostStatus = function() {};
Statistics.prototype.startPeer = function() {};
Statistics.prototype.abortPeer = function() {};
