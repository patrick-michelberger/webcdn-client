/**
 * Receive user's current geolocation 
 * @param {getCurrentPositionCallback} callback - The callback that handles the response.
 */
module.exports = function getCurrentPosition(callback) {
    var localGeolocation = getGeolocation();
    if (!localGeolocation) {

        if (navigator.geolocation) {
            navigator.geolocation.getCurrentPosition(geo_success, geo_error);
        } else {
            var err = new Error("Sorry, no geo position available.");
            callback(err, null);
        }
    } else {
        callback(null, localGeolocation)
    }

    // Helpers
    function saveGeolocation(position) {
        if (window.localStorage) {
            window.localStorage.setItem("latitude", position.latitude);
            window.localStorage.setItem("longitude", position.longitude);
        }
    };

    function getGeolocation() {
        if (window.localStorage && window.localStorage.getItem("latitude") && window.localStorage.getItem("longitude")) {
            var position = {
                "latitude": window.localStorage.getItem("latitude"),
                "longitude": window.localStorage.getItem("longitude")
            };
            return position;
        } else {
            return false;
        }
    };

    // Callbacks
    function geo_success(position) {
        var latitude = position.coords.latitude;
        var longitude = position.coords.longitude;
        var position = {
            "latitude": latitude,
            "longitude": longitude
        };
        saveGeolocation(position);
        callback(null, position);
    };

    function geo_error(err) {
        callback(err, null);
    };

};

/**
 * getCurrentPosition callback
 * @callback getCurrentPositionCallback
 * @param {Object} error - 
 * @param position
 * @param {String} position.latitude - latitude value
 * @param {String} position.longitude - longitude value
 */