const assert = require('assert');

describe('planar_vector_tiles', function _() {
    let result;
    before(async () => {
        result = await loadExample(`http://localhost:${itownsPort}/examples/planar_vector_tiles.html`, this.fullTitle());
    });

    it('should run', async () => {
        assert.ok(result);
    });
});
