var expect = chai.expect;

/*
if (!Function.prototype.bind) {
    Function.prototype.bind = function() {
        var fn = this,
            args = Array.prototype.slice.call(arguments),
            context = args.shift();
        return function() {
            fn.apply(context, args);
        };
    };
}
*/

describe('WebCDN', function() {
	before(function() {
		this.webcdn = new WebCDN();
	});

	describe('.load', function() {
		it('should xxxx', function() {
			expect(true).to.equal(true);
		});
	});
});
