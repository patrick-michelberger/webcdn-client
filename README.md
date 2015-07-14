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

### WebCDN()

### WebCDN(opts:Object)

### WebCDN#init(coordinatorUrl:String):void

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
