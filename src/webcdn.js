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

        this._items = {};
        this._hashes = [];
        this._messenger = new Messenger();
        this._peernet = new Peernet({
            signalChannel: this._messenger
        });

        self._messenger.on('lookup-response', function(data) {
            if (data.peerid) {
                // TODO create datachannel self._peernet.createConnection(data.peerid);
                var peer = self._peernet.createConnection(data.peerid);
                peer.doOffer();
            } else {
                // CDN Fallback
                self._loadImageByCDN(data.hash);
            }
        });

        self.init = function(coordinatorUrl, callback) {
            self.connect(coordinatorUrl, function() {
                self._initHashing();
                self._initLookup();
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
                self._hashes.push(hash);
                self._items[hash] = item.id;
                item.dataset.webcdnHash = hash;
            });
        };

        self._getItemHash = function(item) {
            var data = getImageData(item);
            var hash = sha1(item.id);
            return hash;
        };

        self._update = function(hashes) {
            self._messenger.send('update', hashes);
        };

        self._initLookup = function() {
            for (var hash in self._items) {
                self.load(hash, self._items[hash]);
            }
        };

        self._lookup = function(hash) {
            self._messenger.send('lookup', hash);
        };

        self._loadImageByCDN = function(hash) {
            var id = self._items[hash];
            var element = document.getElementById(id);
            element.onload = function() {
                self._update([hash]);
            };
            element.src = element.dataset.webcdnFallback;
        }
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
