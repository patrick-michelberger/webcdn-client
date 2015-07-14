# WebCDN
Client for a browser-based content distribution network using WebRTC

```js
var webcdn = new WebCDN();
webcdn.init('ws://webcdn.michelberger.info:1337', function() {
  console.log("Your WebCDN is ready!");
});
```
Currently, we are offering a coordinator server for testing purposes at ws://webcdn.michelberger.info:1337.

## Installation

```bash
$ bower install webcdn
```

or 

```bash
$ npm install webcdn-client
```

## API

### WebCDN

Exposed by including `webcdn.js`into your project.

### WebCDN()

Creates a new `WebCDN` client:

```js
var webcdn = new WebCDN();
```

### WebCDN(opts:Object)

Optionally, the first argument of the `WebCDN` constructor can be an options object.

The following options are supported:

  - `bucketUrl` String - Set the root URL for static resource hosting (optional)
  - `trackGeolocation` Boolean - Enable the HTML5 Geolocation API (optional)


### WebCDN#init(coordinatorUrl:String [,callback:Function])

Connects to a given `coordinatorUrl` and fires optionally a `callback` function with `error` signature (if any).  
The client is automatically a peer of the WebCDN network identified with its uuid.

## Examples

To view the examples, clone the WebCDN repo and install the dependencies:

```bash
$ git clone git@github.com:pmichelberger/webcdn-client.git
$ cd webcdn-client
$ npm install
```

Then run `grunt` and visit `http://localhost:8000/examples`. Open the same URL via a second browser window and visit your browser network & console panel.

## Tests

To run the test suite, first install the dependencies, then run `grunt` and visit `http:localhost:8000/tests`:

```bash
$ npm install && bower install
$ grunt
```
