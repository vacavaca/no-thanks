const assert = require('assert')
const { compose, decompose } = require('../../src')

describe('compose', () => {
    it('should wrap a promise', async () => {
        let original;
        const value1 = await (async () => {
            original = compose(Promise.resolve(42))
            return original
        })()

        const value2 = await original
        assert.equal(value1, value2)
    })
})

describe('decompose', () => {
    it('should wrap a promise', async () => {
        let original = { id: 1 }
        const value1 = decompose(await (async () =>
            compose(Promise.resolve(original)))())

        assert.equal(await value1, original)
    })
})

describe('compose and decompose', () => {
    it('should wrap and unwrap promise', () => {
        const value = { id: 1 }
        return async () => compose(Promise.resolve(value))()
            .then(decompose)
            .then(result => {
                assert.equal(result, value)
            })
    })
})