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

