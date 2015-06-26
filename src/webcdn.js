'use strict';

var sha1 = require('sha1');

(function(window) {

    function WebCDN(config) {
        // Private attributes
        var self = this;
        var socket = null;
        var pc = null;
        var sendChannel = null;
        var uuid = UUID();
        var events = [];

        // Private Methods
        var handleRelayMessage = function() {
            // TODO
            console.log("handleRelayMessage...");
        };

        var sendMessage = function(type, data, receiver) {
            var msg = {
                type: type,
                to: receiver,
                data: data
            };
            var s_msg = JSON.stringify(msg);
            console.log("sendMessage...: ", s_msg);
            socket.send(s_msg);
        };

        // Public Methods (API)
        self.initHashing = function() {
            var items = [].slice.call(document.querySelectorAll('[data-webcdn-fallback]'));
            items.forEach(function(item) {
                var hash = self.getItemHash(item);
                item.dataset.webcdnHash = hash;
            });
        };

        self.getItemHash = function(item) {
            var data = getImageData(item);
            var hash = sha1(data);
            return hash;
        };


        self.connect = function(coordinatorUrl, callback) {
            if (socket) {
                trace("Socket exist, init fail.");
                callback();
                return;
            }

            socket = new WebSocket(coordinatorUrl + '?id=' + uuid);

            socket.addEventListener("open", function(event) {
                trace("WebSocket.onopen", event);
                callback();
                // TODO initPeerConnection();
            }, false);
            socket.addEventListener("close", function(event) {
                trace("WebSocket.onclose", event);
            }, false);
            socket.addEventListener("error", function(event) {
                trace("WebSocket.onerror", event);
            }, false);
            socket.addEventListener("message", function(event) {
                trace("WebSocket.onmessage", event);
                var msg = JSON.parse(event.data);
                if (msg.type == "relay" && msg.data) {
                    handleRelayMessage(msg.data);
                }
            }, false);

        };

        self.disconnect = function() {
            socket.close();
            socket = null;
        };

        self.sendUpdate = function(hashes) {
            console.log("sendUpdate: ", this);
            sendMessage('update', hashes);
        };
    };

    // helpers
    function getImageData(domElement) {
        var canvas = document.createElement('canvas');
        canvas.width = domElement.width;
        canvas.height = domElement.height;
        var context = canvas.getContext('2d');
        context.drawImage(domElement, 0, 0, domElement.width, domElement.height);
        var data = canvas.toDataURL("image/jpeg");
        return data;
    };

    function trace(text) {
        //console.log((performance.now() / 1000).toFixed(3) + ": " + text);
        console.log(text);
    };

    // Generate UUID
    var UUID = (function() {
        function b(
            a // placeholder
        ) {
            return a // if the placeholder was passed, return
                ? ( // a random number from 0 to 15
                    a ^ // unless b is 8,
                    Math.random() // in which case
                    * 16 // a random number from
                    >> a / 4 // 8 to 11
                ).toString(16) // in hexadecimal
                : ( // or otherwise a concatenated string:
                    [1e7] + // 10000000 +
                    -1e3 + // -1000 +
                    -4e3 + // -4000 +
                    -8e3 + // -80000000 +
                    -1e11 // -100000000000,
                ).replace( // replacing
                    /[018]/g, // zeroes, ones, and eights with
                    b // random hex digits
                )
        }
        return b;
    })();

    window.WebCDN = WebCDN;
})(window);
