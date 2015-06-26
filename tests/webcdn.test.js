window.WebSocket = MockSocket;

var expect = chai.expect;
var updateMessage = '{"type":"update","data":["123456","125355"]}';

describe('WebCDN', function() {
    var self = this;

    var mockServer = new MockServer('ws://localhost:8080');

    mockServer.on('connection', function(server) {
        server.on('update', function(data) {
            server.send('success');
        });
    });

    before(function() {
        self.webcdn = new WebCDN();
    });

    describe('.initHashing', function() {
        it('should hash each marked P2P object', function() {
            self.webcdn.initHashing();
            var items = [].slice.call(document.querySelectorAll('[data-webcdn-fallback]'));
            items.forEach(function(item) {
                expect(item.dataset.webcdnHash).not.to.be.empty;
            });
        });
    });

    describe('.getItemHash', function() {
        it('should return a hash for a DOM element', function() {
            var imageNode = document.querySelector('[data-webcdn-fallback]');
            var hash = self.webcdn.getItemHash(imageNode);
            expect(hash).to.equal('9be2d5a9a52ee415ac31fa0c01e41b05d969e8c4');
        });
    });

    /*
    describe('.connect', function() {
        it('should connect to a websocket server', function() {
            var spy = sinon.spy(window, 'WrapWebSocket');
            self.webcdn.connect('ws://' + location.hostname + ':1337', function() {
                console.log("connected to socket server");
                expect(spy.calledOnce);
            });
        });
    });
    

    describe('.update', function() {
        it('should send a update message to the websocket server', function() {
            self.webcdn.connect('ws://' + location.hostname + ':1337', function() {
                self.webcdn.sendUpdate(updateMessage);
            });
        });
    });
    */

    /*
        describe('.socketTest', function() {
            it('should do something', function() {
                // This is creating a MockSocket object and not a WebSocket object
                var mockSocket = new WebSocket('ws://localhost:8080');
                expect(2);

                mockSocket.onopen = function(e) {
                    console.log("socket open");a
                    //equal(true, true, 'onopen fires as expected');
                };

                mockSocket.onmessage = function(data) {
                    console.log("socket message: ", data);
                };

                mockSocket.send('world');
            });
        });
    */


});
