module.exports = Resource;

/**
 * Creates a new Resource instance
 * @param {String} hash - unique resource ID
 * @param {Number} wsConnectDuration - websocket connect duration
 * @constructor
 */
function Resource(hash, wsConnectDuration) {
    if (typeof hash === 'undefined') {
        throw new Error('Hash ID as first parameter required!');
    }
    if (typeof wsConnectDuration === 'undefined') {
        throw new Error('Websocket connect duration as second parameter required!');
    }
	this.hash = hash 
	this.leecher = window.webcdn_uuid;
	this.ws_connect = wsConnectDuration;
};

Resource.prototype.setDuration = function(type, value) {
	this[type] = value;
};

/*
var ResourceSchema = {
    "leecher": String,
    "seeder": String,
    "ws_connect": Number,
    "lookup": Number,
    "pc_connect": Number,
    "fetch": Number,
    "sendImage_duration": Number,
    "total": Number
};
*/