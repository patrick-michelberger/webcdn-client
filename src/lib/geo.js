module.exports = function getCurrentPosition(callback) {
    if (navigator.geolocation) {
        var options = {};

        function geo_success(position) {
            var latitude = position.coords.latitude;
            var longitude = position.coords.longitude;
            var position = {
                "latitude": latitude,
                "longitude": longitude
            };
            callback(null, position);
        };

        function geo_error(err) {
            callback(err, null);
        };
        navigator.geolocation.getCurrentPosition(geo_success, geo_error, options);
    } else {
        var err = new Error("Sorry, no geo position available.");
        callback(err, null);
    }
};
