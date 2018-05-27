const assert = require('assert')

const { CancellablePromise, cancellable } = require('../src')
const { endsWith, patchItToCheckUnhandledRejections } = require('./util')

const createTask = (timeout, name, log) => new Promise(resolve => {
    if (log != null)
        log.push(`start ${name}`)
    setTimeout(() => {
        if (log != null)
            log.push(`done ${name}`)
        resolve(name)
    }, timeout)
})


global.it = patchItToCheckUnhandledRejections()
describe("cancellable", () => {
    it('should provide fine-grained arg', done => {
        const value1 = { id: 1 }
        const value2 = { id: 2 }
        cancellable(async (grain, arg1, arg2, arg3) => {
            assert.ok(grain instanceof Function)
            assert.equal(arg1, value1)
            assert.equal(arg2, value2)
            assert.equal(arg3, undefined)
            done()
        })(value1, value2)
    })

    it('should not provide fine-grained arg if disabled', done => {
        const value1 = { id: 1 }
        const value2 = { id: 2 }
        cancellable(async (arg1, arg2, arg3) => {
            assert.equal(arg1, value1)
            assert.equal(arg2, value2)
            assert.equal(arg3, undefined)
            done()
        }, null, false)(value1, value2)
    })

    it('should cancel fine-grained', done => {
        const log = []
        const task1 = createTask(4, 1, log)
        const job = cancellable(async (grain) => {
            try {
                await task1
                await grain(createTask(4, 2, log))
                await grain(createTask(4, 3, log))
                log.push('then')
            } catch (err) {
                done(err)
            }
        })()

        setTimeout(() => job.cancel(), 5)

        endsWith(
            () => (log.includes('done 2') && !log.includes('then')),
            16, "Promise isn't done or fulfilled")
            .then(() => {
                assert.deepEqual(log, [
                    'start 1',
                    'done 1',
                    'start 2',
                    'done 2'
                ])
            })
            .then(done, done)
    })


    it('should not cancel fine-grained if not used', done => {
        const log = []
        const task1 = createTask(4, 1, log)
        const job = cancellable(async () => {
            try {
                await task1
                await createTask(4, 2, log)
                await createTask(4, 3, log)
            } catch (err) {
                done(err)
            }
        })().then(() => log.push('then'))

        setTimeout(() => job.cancel(), 5)

        endsWith(
            () => (log.includes('done 2') && !log.includes('then')),
            16, "Promise isn't done or fulfilled")
            .then(() => {
                assert.deepEqual(log, [
                    'start 1',
                    'done 1',
                    'start 2',
                    'done 2',
                    'start 3',
                    'done 3'
                ])
            })
            .then(done, done)
    })

    it('should not cancel fine-grained if disabled', done => {
        const log = []
        const task1 = createTask(4, 1, log)
        const job = cancellable(async () => {
            try {
                await task1
                await createTask(4, 2, log)
                await createTask(4, 3, log)
            } catch (err) {
                done(err)
            }
        }, null, false)().then(() => log.push('then'))

        setTimeout(() => job.cancel(), 5)

        endsWith(
            () => (log.includes('done 2') && !log.includes('then')),
            16, "Promise isn't done or fulfilled")
            .then(() => {
                assert.deepEqual(log, [
                    'start 1',
                    'done 1',
                    'start 2',
                    'done 2',
                    'start 3',
                    'done 3'
                ])
            })
            .then(done, done)
    })

    it('should accept finalizer', done => {
        const promise = cancellable(async () => { }, () => { })()
        assert(promise instanceof CancellablePromise)
        assert(promise instanceof Promise)
        assert(promise.then instanceof Function)
        assert(promise.then.length === 2)

        assert(promise.catch instanceof Function)
        assert(promise.catch.length === 1)

        if (Promise.prototype.finally) {
            assert(promise.finally instanceof Function)
            assert(promise.finally.length === 1)
        }

        assert(promise.cancel instanceof Function)
        assert(promise.cancel.length === 0)

        done()
    })

    it('should not call finalizer on fulfill', done => {
        cancellable(async () => { }, () => assert.fail())().then(done)
    })

    it('should return cancellation promise', done => {
        const job = cancellable(async () => {
            try {
                await createTask(1, 1)
                assert.fail("unexpected fulfillment")
            } catch (err) {
                done(err)
            }
        })()

        const promise = job.cancel()

        assert(!(promise instanceof CancellablePromise))
        assert(promise instanceof Promise)
        assert(promise.then instanceof Function)
        assert(promise.then.length === 2)

        assert(promise.catch instanceof Function)
        assert(promise.catch.length === 1)

        if (Promise.prototype.finally) {
            assert(promise.finally instanceof Function)
            assert(promise.finally.length === 1)
        }

        assert(promise.cancel === undefined)

        done()
    })


    it('should call finalizer on cancel', done => {
        const finalizer = () => {
            setTimeout(() => done(), 4)
        }

        const job = cancellable(async (grain) => {
            try {
                await grain(createTask(4, 4))
                assert.fail("unexpected fulfillment")
            } catch (err) {
                done(err)
            }
        }, finalizer)()

        job.cancel().catch(done)
    })

    it('should call finalizer once on cancel', done => {
        let finalizerCalls = 0
        let cancelTimerCalled = false
        const finalizer = () => {
            finalizerCalls++
            setTimeout(() => {
                assert.equal(finalizerCalls, 1)
                assert.ok(cancelTimerCalled)
                done()
            }, 15)
        }

        const job = cancellable(async (grain) => {
            try {
                await grain(createTask(4, 4))
                assert.fail("unexpected fulfillment")
            } catch (err) {
                done(err)
            }
        }, finalizer)()

        job.cancel().catch(done)

        setTimeout(() => {
            job.cancel()
            job.cancel()
            cancelTimerCalled = true
        }, 5)
    })

    it('should call finalizer only after fulfill', done => {
        let promiseDone = false
        const finalizer = () => {
            assert.ok(promiseDone)
            done()
        }

        const task = createTask(10, 1)
            .then(() => promiseDone = true)

        const job = cancellable(async () => {
            try {
                await task
            } catch (err) {
                done(err)
            }
        }, finalizer)()

        job.cancel().catch(done)
    })

    it('should call finalizer only after reject', done => {
        let promiseDone = false
        const finalizer = () => {
            assert.ok(promiseDone)
            done()
        }

        const task = createTask(10, 1)
            .then(() => { throw new Error("test") })
            .catch(err => {
                promiseDone = true
                throw err
            })

        const job = cancellable(async () => {
            try {
                await task
            } catch (err) {
                // ignore
            }
        }, finalizer)()

        job.cancel().catch(done)
    })

    it('should call finalizer once on cancel after fulfill', done => {
        let finalizerCalls = 0
        let cancelTimerCalled = false
        const finalizer = () => {
            finalizerCalls++
            setTimeout(() => {
                assert.equal(finalizerCalls, 1)
                assert.ok(cancelTimerCalled)
                done()
            }, 15)
        }

        const job = cancellable(async (grain) => {
            try {
                await grain(createTask(1, 1))
                assert.fail("unexpected fulfillment")
            } catch (err) {
                done(err)
            }
        }, finalizer)()

        job.cancel().catch(done)

        setTimeout(() => {
            job.cancel()
            job.cancel()
            cancelTimerCalled = true
        }, 5)
    })

    it('should call finalizer even if fulfilled', done => {
        let fulfilled = false
        const finalizer = () => {
            assert.ok(fulfilled)
            done()
        }

        const job = cancellable(async () => {
            try {
                await createTask(4, 1)
                fulfilled = true
            } catch (err) {
                done(err)
            }
        }, finalizer)()

        setTimeout(() => job.cancel().catch(done), 10)
    })

    it('should handle cancellation result', done => {
        const value = { id: 1 }
        const finalizer = () => {
            return value
        }

        const job = cancellable(async () => await createTask(4, 1), finalizer)()

        setTimeout(() => job.cancel()
            .then(result => {
                assert.equal(result, value)
                done()
            })
            .catch(done), 10)
    })

    it('should chain cancellation result', done => {
        const value = { id: 1 }
        const finalizer = () => createTask(10, value)

        const job = cancellable(async () => await createTask(4, 1), finalizer)()

        setTimeout(() => job.cancel()
            .then(result => {
                assert.equal(result, value)
                done()
            })
            .catch(done), 10)
    })

    it('should handle cancellation result before fulfill', done => {
        const value = { id: 1 }
        const finalizer = () => {
            return value
        }

        const job = cancellable(async grain => {
            try {
                await grain(createTask(20, 1))
                await grain(createTask(10, 1))
                assert.fail("unexpected fulfillment")
            } catch (err) {
                done(err)
            }
        }, finalizer)()

        setTimeout(() => job.cancel()
            .then(result => {
                assert.equal(result, value)
                done()
            })
            .catch(done), 15)
    })

    it('should handle cancellation rejection', done => {
        const finalizer = () => {
            throw new Error("Test")
        }

        const job = cancellable(async () => await createTask(4, 1), finalizer)()

        setTimeout(() => job.cancel()
            .then(() => done(new Error("Expected exit with error")))
            .catch(() => done()
            ), 10)
    })

    it('should handle cancellation rejection before fulfull', done => {
        const finalizer = () => {
            throw new Error("Test")
        }

        const job = cancellable(async (grain) => {
            await grain(createTask(20, 1))
            assert.fail("unexpected fulfillment")
        }, finalizer)()

        setTimeout(() => job.cancel()
            .then(() => done(new Error("Expected exit with error")))
            .catch(() => done()
            ), 4)
    })

    it('should handle synchronous cancellation result', done => {
        const value = { id: 1 }
        const finalizer = () => {
            return value
        }

        const job = cancellable(async (grain) => {
            await grain(createTask(4, 1))
            assert.fail("unexpected fulfillment")
        }, finalizer)()

        job.cancel()
            .then(result => {
                assert.equal(result, value)
                done()
            })
            .catch(done)
    })

    it('should handle synchronous cancellation rejection', done => {
        const finalizer = () => {
            throw new Error("Test")
        }

        const job = cancellable(async (grain) => {
            await grain(createTask(4, 1))
            assert.fail("unexpected fulfillment")
        }, finalizer)()

        job.cancel()
            .then(() => done(new Error("Expected exit with error")))
            .catch(() => done())
    })

    it('should call finalizer with results of grains', done => {
        const value1 = { id: 1 }
        const value2 = { id: 2 }
        const value3 = { id: 3 }

        const finalizer = (arg1, arg2, ...rest) => {
            assert.equal(arg1, value1)
            assert.equal(arg2, value2)
            assert.equal(rest.length, 0)
            done()
        }

        const job = cancellable(async grain => {
            try {
                grain(value1)
                await grain(createTask(10, value2))
                await grain(createTask(10, value3))
            } catch (err) {
                done(err)
            }
        }, finalizer)()

        setTimeout(() => {
            job.cancel().catch(done)
        }, 5)
    })

    it('should call finalizer with result of top grain', done => {
        const value1 = { id: 1 }

        const finalizer = (arg1, ...rest) => {
            assert.equal(arg1, value1)
            assert.equal(rest.length, 0)
            done()
        }

        const job = cancellable(async () => {
            try {
                return value1
            } catch (err) {
                done(err)
            }
        }, finalizer)()

        setTimeout(() => {
            job.cancel().catch(done)
        }, 5)
    })

    it('should call finalizer with results of all grains', done => {
        const value1 = { id: 1 }
        const value2 = { id: 2 }

        const finalizer = (arg1, arg2, ...rest) => {
            assert.equal(arg1, value1)
            assert.equal(arg2, value2)
            assert.equal(rest.length, 0)
            done()
        }

        const job = cancellable(async grain => {
            try {
                await grain(createTask(1, value1))
                return value2
            } catch (err) {
                done(err)
            }
        }, finalizer)()

        setTimeout(() => {
            job.cancel().catch(done)
        }, 5)
    })

    it('should call finalizer only with slice of results', done => {
        const value1 = { id: 1 }
        const value2 = { id: 2 }
        const value3 = { id: 3 }
        const value4 = { id: 4 }

        const finalizer = (arg1, arg2, arg3, ...rest) => {
            assert.equal(arg1, value1)
            assert.equal(arg2, value2)
            assert.equal(arg3, value3)
            assert.equal(rest.length, 0)
            done()
        }

        const job = cancellable(async grain => {
            try {
                await grain(createTask(1, value1))
                await grain(createTask(1, value2))
                return value3
            } catch (err) {
                done(err)
            }
        }, finalizer)()

        job.then(() => createTask(1, value4))
            .then(result => {
                assert.equal(result, value4)
            }, done)

        setTimeout(() => job.cancel().catch(done), 10)
    })

    it('should call finalizer before next consumer starts execution', done => {
        const value1 = { id: 1 }
        const value2 = { id: 2 }
        const value3 = { id: 3 }
        let nextCalled = false

        const finalizer = () => {
            assert.ok(!nextCalled)
            done()
        }

        const job = cancellable(async grain => {
            await grain(createTask(10, value1))
            await grain(createTask(10, value2))
        }, finalizer)()

        job.then(() => createTask(15, value3))
            .then(() => nextCalled = true, done)

        setTimeout(() => job.cancel().catch(done), 15)
    })

    // TODO finalizer on reject
    // TODO Promise.all, etc
})