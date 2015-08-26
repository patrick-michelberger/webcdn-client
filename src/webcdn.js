'use strict';

/**
 * @fileOverview WebCDN - A Content Distribution Network from web browsers using WebRTC
 * @author Patrick Michelberger
 * @example
 * var webcdn = new WebCDN();
 * webcdn.init('ws://webcdn.michelberger.info:1337', function() { 
 *   console.log("Your WebCDN is ready!");
 * });
 * @see <a href="http://webcdn.michelberger.info">WebCDN project website</a>.
 */

window.webcdn_uuid = require('./lib/uuid.js')();

var sha1 = require('sha1');
var EventEmitter = require('events').EventEmitter;
var inherits = require('util').inherits;
var Messenger = require('./lib/messenger.js');
var Peernet = require('./lib/peernet.js');
var Statistics = require('./lib/statistics.js');
var getCurrentPosition = require('./lib/geo.js');

window.WebCDN = WebCDN;
inherits(WebCDN, EventEmitter);

/**
 * Creates a new WebCDN instance
 * @param config - configuration settings
 * @param {String} config.bucketUrl - Ressources have to be CORS-enables, for testing purposes mirror them in a configurable AWS bucket 
 * @param {Boolean} config.trackGeolocation - Use HTML5 Geolocation API to identify user's current position
 * @constructor
 */
function WebCDN(config) {
    config = config ||  {};
    var self = this;
    this._bucketUrl = config.bucketUrl ||  false;
    this._trackGeolocation = config.trackGeolocation ||  false;
    this._items = []; // marked resources for WebCDN distribution
    this._messenger = new Messenger();
    this._peernet = new Peernet({
        signalChannel: this._messenger
    });

    this._messenger.on('lookup-response', function(data) {
        Statistics.mark("lookup_end:" + data.hash);
        if (data.peerid) {
            Statistics.mark("pc_connect_start:" + data.peerid);
            var peer = self._peernet.createConnection(data.peerid, data.hash);
            peer.doOffer();
        } else {
            // CDN Fallback
            self._loadImageByCDN(data.hash);
        }
    });
};

/**
 * Initializes a WebCDN instance
 * @param {String} coordinatorUrl
 * @param {callback} callback - Fires the WebCDN client is ready and has connected to the coordinator
 * @public
 */
WebCDN.prototype.init = function(coordinatorUrl, callback) {
    var self = this;
    var id = getQueryId(coordinatorUrl)
    this.uuid = id ||  window.webcdn_uuid;
    if (!id) {
        coordinatorUrl += "?id=" + self.uuid;
    }

    if (this._trackGeolocation) {
        this.emit('geolocation:start');
        getCurrentPosition(function(err, position) {
            self.emit('geolocation:end');
            if (!err && position) {
                coordinatorUrl += '&lat=' + position.latitude + '&lon=' + position.longitude;
            }
            connect(callback);
        });
    } else {
        connect(callback);
    }

    function connect(callback) {
        self._connect(coordinatorUrl, function() {
            self._initHashing();
            self._initLookup();
            callback();
        });
    };
};

/**
 * Load a resource with a given content hash
 * @param {String} hash resouce hash computed by _getItemHash()
 * @pubic
 */
WebCDN.prototype.load = function(hash) {
    this._lookup(hash);
};

/**
 * Connect to a given WebCDN coordinator serve
 * @param {String} url coordinator's URL
 * @param {callback} callback
 * @private
 */
WebCDN.prototype._connect = function(url, callback) {
    this._messenger.connect(url, function() {
        callback();
    });
};

/**
 * Computes an unique hash value for each resource marked with a data-webcdn-callback attribute 
 * @private
 */
WebCDN.prototype._initHashing = function() {
    var items = this._items = [].slice.call(document.querySelectorAll('[data-webcdn-fallback]'));
    items.forEach(function(item) {
        item.dataset.webcdnHash = this._getItemHash(item);
    }, this);
};

/**
 * Computes an unique hash value for a given DOM object 
 * @param {Object} item DOM object
 * @private
 */
WebCDN.prototype._getItemHash = function(item) {
    var hash = sha1(item.dataset.webcdnFallback);
    return hash;
};


/**
 * Send a "update" message to inform the coordinator about stored items
 * @param {Array} hashes Content hashes computed by _getItemHash()
 * @private
 */
WebCDN.prototype._update = function(hashes) {
    this._messenger.send('update', hashes);
};

/**
 * Iterates about each marked WebCDN items and executes a "lookup" request to the coordinator
 * @private
 */
WebCDN.prototype._initLookup = function() {
    this._items.forEach(function(item) {
        this.load(item.dataset.webcdnHash);
    }, this);
};

/**
 * Send a "lookup" message for a given resource to the coordinator
 * @param {String} hash content hash value
 * @private
 */
WebCDN.prototype._lookup = function(hash) {
    Statistics.mark("lookup_start:" + hash);
    this._messenger.send('lookup', hash);
};

/**
 * Downloads a given resouce from its CDN fallback URL
 * @param {String} hash content hash value
 * @private
 */
WebCDN.prototype._loadImageByCDN = function(hash) {
    var self = this;
    var element = document.querySelector('[data-webcdn-hash="' + hash + '"]')

    if (this._bucketUrl) {
        if (element.dataset.webcdnFallback.charAt(0) === '/') {
            element.dataset.webcdnFallback = element.dataset.webcdnFallback.slice(1);
        }
        element.dataset.webcdnFallback = this._bucketUrl + element.dataset.webcdnFallback.replace(/.*:?\/\//g, "");
    }

    element.onload = function() {
        element.dataset.webcdnData = getImageData(element);
        Statistics.queryResourceTiming(this.dataset.webcdnFallback);
        self._update([hash]);
    };

    element.setAttribute('crossOrigin', 'anonymous');
    element.src = element.dataset.webcdnFallback;
};

/**
 * Querys user's current location and sends it to the coordinator server
 * @private
 */
WebCDN.prototype._sendGeolocation = function() {
    var self = this;
    getCurrentPosition(function(err, position) {
        if (!err && position) {
            self._messenger.send('geolocation', position);
        }
    });
};

/**
 * Draws a given image on a canvas element and returns it DataURL
 * @function getImageData
 * @param domElement 
 * @returns {String}
 */
function getImageData(domElement) {
    var canvas = document.createElement('canvas');
    canvas.width = domElement.width;
    canvas.height = domElement.height;
    var context = canvas.getContext('2d');
    context.drawImage(domElement, 0, 0, domElement.width, domElement.height);
    var data = canvas.toDataURL("image/jpeg");
    return data;
};

/**
 * Returns query id from a given URL string
 * @function getQueryId
 * @param {String} url
 * @returns {String}
 */
function getQueryId(url) {
    var regex = /\?id=(\d*)/;
    var result = regex.exec(url);
    if (result && result[1]) {
        return result[1];
    } else {
        return false;
    }
};
