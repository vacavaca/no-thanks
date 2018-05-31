const assert = chai.assert
const noThanks = window.noThanks

if (!window.AbortController) {
    class AbortControllerPolyfill {
        constructor () {
            this.signal = { abrted: false }
        }

        abort() {
            this.signal.aborted = true
        }
    }

    window.AbortController = AbortControllerPolyfill
}

const fail = obj => assert.fail(null, null, obj)

describe('examples', function () {
    this.slow(120)

    it('should cancel fetch', done => {
        const controller = new AbortController()

        const request = noThanks.interruptible(() =>
            fetch('/test', {
                signal: controller.signal,
            }), () => controller.abort())()
            .then(() => fail('unexpected fulfillment'))
            .catch(done)

        setTimeout(() => {
            request.cancel()
                .then(() => {
                    assert.ok(controller.signal.aborted)
                    done()
                })
                .catch(done)
        }, 25)
    })

    it('should not cancel fetch', () => {
        const controller = new AbortController()

        return noThanks.interruptible(() =>
            fetch('/test', {
                signal: controller.signal,
            }), () => controller.abort())()
            .then(response => response.text())
            .then(result => assert.equal(result, 'test'))
    })

    it('should cancel fetch without closure', done => {
        let saveController;
        const request = noThanks.interruptible(async grain => {
            const controller = grain(new AbortController())
            saveController = controller
            return await fetch('/test', {
                signal: controller.signal,
            })
        }, controller => controller != null && controller.abort())

        const promise = request()
            .then(() => fail('unexpected fulfillment'))
            .catch(done)

        setTimeout(() => {
            promise.cancel()
                .then(() => {
                    assert.ok(saveController.signal.aborted)
                    done()
                })
                .catch(done)
        }, 25)
    })

    it('should not cancel fetch without closure', () => {
        const request = noThanks.interruptible(async grain => {
            const controller = grain(new AbortController())
            return await fetch('/test', {
                signal: controller.signal,
                /* other request options */
            })
        }, controller => controller != null && controller.abort())

        return request()
            .then(response => response.text())
            .then(result => assert.equal(result, 'test'))
    })

    it('should cancel general purpose fetch', done => {
        let saveController;
        const request = noThanks.interruptible(
            async (grain, url, options = {}) => {
                const controller = grain(new AbortController())
                saveController = controller
                return await fetch(url, Object.assign({}, options, {
                    signal: controller.signal,
                }))
            }, controller => controller != null && controller.abort())

        const promise = request('/test')
            .then(() => fail('unexpected fulfillment'))
            .catch(done)

        setTimeout(() => {
            promise.cancel()
                .then(() => {
                    assert.ok(saveController.signal.aborted)
                    done()
                })
                .catch(done)
        }, 25)
    })

    it('should not cancel general purpose fetch', () => {
        const request = noThanks.interruptible(
            async (grain, url, options = {}) => {
                const controller = grain(new AbortController())
                return await fetch(url, Object.assign({}, options, {
                    signal: controller.signal,
                }))
            }, controller => controller != null && controller.abort())

        return request('/test')
            .then(response => response.text())
            .then(result => assert.equal(result, 'test'))
    })

    it('should cancel new jquery', done => {
        const request = noThanks.interruptible(async grain => {
            const request = grain(jQuery3.ajax({
                url: '/test'
            }))
            return request.promise()
        }, request => {
            if (request != null)
                return request.abort()
                    .catch(err => {
                        if (err.statusText === 'abort')
                            return;

                        throw err
                    })
        })()
            .then(() => fail('unexpected fulfillment'))
            .catch(done)

        setTimeout(() => {
            request.cancel()
                .then(done, done)
        }, 25)
    })

    it('should not cancel new jquery', () => {
        return noThanks.interruptible(async grain => {
            const request = grain(jQuery3.ajax({
                url: '/test'
            }))
            return request.promise()
        }, request => {
            if (request != null)
                return request.abort()
                    .catch(err => {
                        if (err.statusText === 'abort')
                            return;

                        throw err
                    })
        })()
    })

    it('should cancel old jquery', done => {
        const request = noThanks.interruptible(async grain => {
            return await new Promise((resolve, reject) => grain(jQuery1.ajax({
                url: '/test',
                success: resolve,
                error: (jqXhr, status, errorMessage) => {
                    if (status === 'abort') resolve(jqXhr)
                    else reject(new Error(errorMessage))
                }
            })))
        }, request => { request != null && request.abort() })()
            .then(() => fail('unexpected fulfillment'))
            .catch(done)

        setTimeout(() => {
            request.cancel()
                .then(done, done)
        }, 25)
    })
})
