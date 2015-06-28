'use strict';

var sha1 = require('sha1');
var Messenger = require('./lib/messenger.js');
var Peernet = require('./lib/peernet.js');
var Logger = require('./lib/logger.js');

(function(window) {

    window.logger = new Logger();

    function WebCDN(config) {
        // Private attributes
        var self = this;
        var events = [];

        this._hashs = [];
        this._messenger = new Messenger();
        this._peernet = new Peernet({
            signalChannel: this._messenger
        });

        self._messenger.on('lookup-response', function(peerId) {
            console.log("create peer connection with ", peerId);
            self._peernet.createConnection(peerId);
        });

        self.init = function(coordinatorUrl, callback) {
            var self = this;
            self.connect(coordinatorUrl, function() {
                self._initHashing();
                self._update(self._hashs);
                callback();
            });
        };

        self.connect = function(coordinatorUrl, callback) {
            self._messenger.connect(coordinatorUrl, function() {
                callback();
            });
        };

        self.load = function(content_hash, id) {
            var elem = document.getElementById(id);
            self._lookup(content_hash);
        };

        self._initHashing = function() {
            var items = [].slice.call(document.querySelectorAll('[data-webcdn-fallback]'));
            items.forEach(function(item) {
                var hash = self._getItemHash(item);
                self._hashs.push(hash);
                item.dataset.webcdnHash = hash;
                self.load(hash, item.id)
            });
        };

        self._getItemHash = function(item) {
            var data = getImageData(item);
            var hash = sha1(data);
            return hash;
        };

        self._update = function(hashes) {
            self._messenger.send('update', hashes);
        };

        self._lookup = function(hash) {
            self._messenger.send('lookup', hash);
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

    window.WebCDN = WebCDN;
})(window);
