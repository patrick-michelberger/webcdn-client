'use strict';
var sha1 = require('sha1');
var Messenger = require('./lib/messenger.js');
var Peernet = require('./lib/peernet.js');
var Logger = require('./lib/logger.js');

(function(window) {

    window.logger = new Logger();

    function WebCDN(config) {
        // Private attributes
        config = config ||  {};
        var self = this;
        var events = [];
        this._bucketUrl = config.bucketUrl ||  false;
        this._items = {};
        this._hashes = [];
        this._messenger = new Messenger();
        this._peernet = new Peernet({
            signalChannel: this._messenger
        });

        self._messenger.on('lookup-response', function(data) {
            if (data.peerid) {
                var peer = self._peernet.createConnection(data.peerid, data.hash);
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
            var hash = sha1(item.dataset.webcdnFallback);
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
            var element = document.querySelector('[data-webcdn-hash="' + hash + '"]')
            element.onload = function() {
                self._update([hash]);
            };
            if (self._bucketUrl) {
                if (element.dataset.webcdnFallback.charAt(0) === '/') {
                    element.dataset.webcdnFallback = element.dataset.webcdnFallback.slice(1);
                }
                element.dataset.webcdnFallback = self._bucketUrl + element.dataset.webcdnFallback.replace(/.*:?\/\//g, "");
            }
            getBase64FromImage(element.dataset.webcdnFallback, function(base64) {
                element.src = base64;
            }, function() {
                element.src = element.dataset.webcdnFallback;
            });
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

    function getBase64FromImage(url, onSuccess, onError) {
        var xhr = new XMLHttpRequest();
        xhr.responseType = "arraybuffer";
        xhr.open("GET", url);
        xhr.onload = function() {
            var base64, binary, bytes, mediaType;

            bytes = new Uint8Array(xhr.response);
            //NOTE String.fromCharCode.apply(String, ...
            //may cause "Maximum call stack size exceeded"
            binary = [].map.call(bytes, function(byte) {
                return String.fromCharCode(byte);
            }).join('');
            mediaType = xhr.getResponseHeader('content-type');
            base64 = [
                'data:',
                mediaType ? mediaType + ';' : '',
                'base64,',
                btoa(binary)
            ].join('');
            onSuccess(base64);
        };
        xhr.onerror = onError;
        xhr.send();
    };



    window.WebCDN = WebCDN;
})(window);
