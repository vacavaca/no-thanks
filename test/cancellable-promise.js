/* eslint-disable require-jsdoc */
const assert = require('assert')

const { CancellablePromise, cancellable } = require('../src')
const { endsWith, checkUnhandledRejections } = require('./util')

const createTask = (timeout, name, log) => new Promise(resolve => {
    if (log != null)
        log.push(`start ${name}`)
    setTimeout(() => {
        if (log != null)
            log.push(`done ${name}`)
        resolve(name)
    }, timeout)
})

const bufferIt = it
const itCheckingRejections = (name, test) =>
    bufferIt(name, checkUnhandledRejections(test))

for (const k of Object.keys(bufferIt)) {
    itCheckingRejections[k] = (name, test) =>
        bufferIt[k](name, checkUnhandledRejections(test))
}

global.it = itCheckingRejections

const describeFactories = (factories, description) => {
    for (const name in factories) {
        const factory = factories[name]

        describe(name, () => {
            description(factory)
        })
    }
}

const factories = {
    'CancellablePromise': (...args) => new CancellablePromise(...args),
    'cancellable (alias)': (...args) => cancellable(...args)
}

describe('CancellablePromise (from resolver)', () => {
    it('should create promise from resolver', done => {
        const value = {}
        new CancellablePromise(resolve => resolve(value))
            .then(result => assert.equal(result, value))
            .then(done, done)
    })
})

describeFactories(factories, (factory) => {
    it('should create promise from another', done => {
        const value = {}
        const promise = new Promise(resolve => resolve(value))
        factory(promise)
            .then(result => assert.equal(result, value))
            .then(done, done)
    })

    it('should be promise with cancel method', done => {
        const promise = factory(Promise.resolve())
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

    it('should generate cancelable consumers', done => {
        const promise = factory(Promise.resolve())
            .then(() => { })
            .then(() => { })

        const t1 = promise.then(() => { })
        const t2 = t1.then(() => { })

        assert(t1.cancel instanceof Function)
        assert(t2.cancel.length === 0)

        done()
    })

    it('should fulfill', done => {
        factory(createTask(1, 'task'))
            .then(result => assert.equal(result, 'task'))
            .then(done, done)
    })

    it('should chain promisess', done => {
        factory(createTask(1, 'task'))
            .then(result => {
                assert.equal(result, 'task')
                return createTask(1, 'task 2')
            })
            .catch(() => assert.fail())
            .then(result => assert.equal(result, 'task 2'))
            .then(done, done)
    })

    it('should chain with reject of intermediate', done => {
        const error = new Error("ooops")
        const error2 = new Error("ooops 2")
        factory(createTask(1, 'task'))
            .then(result => {
                assert.equal(result, 'task')
                return createTask(1, 'task 2')
            })
            .catch(() => assert.fail())
            .then(() => Promise.reject(error))
            .then(() => assert.fail())
            .catch(err => assert.equal(err, error))
            .then(() => 42)
            .then(result => assert.equal(result, 42))
            .then(() => { throw new Error("AAA") })
            .catch(() => { throw error2 })
            .then(() => assert.fail())
            .catch(err => assert.equal(err, error2))
            .then(done, done)
    })

    it('should reject', done => {
        const error = new Error("ooops")
        factory(Promise.reject(error))
            .then(() => assert.fail())
            .catch(err => assert.equal(err, error))
            .then(done, done)
    })

    it('should reject next', done => {
        const error = new Error("ooops")
        factory(createTask(1, 'task'))
            .then(() => { throw error })
            .then(() => assert.fail())
            .catch(err => assert.equal(err, error))
            .then(done, done)
    })

    if (Promise.prototype.finally) {
        it('should finalize after fulfill', done => {
            factory(createTask(1, 'task'))
                .finally((...args) => assert.equal(args.length, 0))
                .then(done, done)
        })

        it('should finalize after reject', done => {
            factory((_, reject) => reject(new Error()))
                .finally((...args) => assert.equal(args.length, 0))
                .then(done, done)
        })
    }

    it('should cancel immediatelly', done => {
        const log = []
        const job = factory(createTask(10, 'task', log))
            .then(result => log.push(`then ${result}`))
            .catch(done)

        job.cancel()

        endsWith(
            () => log.includes('done task') && !log.includes('then task'),
            20, "Promise isn't done or fulfilled")
            .then(() => {
                assert.deepEqual(log, [
                    'start task',
                    'done task'
                ])
            })
            .then(done, done)
    })

    it('should cancel after a delay', done => {
        const log = []
        const job = factory(createTask(10, 'task', log))
            .then(result => log.push(`then ${result}`))
            .catch(done)

        setTimeout(() => job.cancel(), 5)

        endsWith(
            () => log.includes('done task') && !log.includes('then task'),
            20, "Promise isn't done or fulfilled")
            .then(() => {
                assert.deepEqual(log, [
                    'start task',
                    'done task'
                ])
            })
            .then(done, done)
    })

    it('should fulfill after a delay', done => {
        const log = []
        const job = factory(createTask(4, 'task', log))
            .then(result => log.push(`then ${result}`))
            .catch(done)

        setTimeout(() => job.cancel(), 8)

        endsWith(
            () => log.includes('done task') && log.includes('then task'),
            12, "Promise isn't done or fulfilled")
            .then(() => {
                assert.deepEqual(log, [
                    'start task',
                    'done task',
                    'then task'
                ])
            })
            .then(done, done)
    })

    it('should cancel fine-grained', done => {
        const log = []
        const task1 = createTask(4, 1, log)
        const job = factory(task1)
            .then(() => createTask(4, 2, log))
            .then(() => createTask(4, 3, log))
            .then(() => log.push(`then`))
            .catch(done)

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

    it('should cancel fine-grained immediatelly', done => {
        const log = []
        const task1 = createTask(4, 1, log)
        const job = factory(task1)
            .then(() => createTask(4, 2, log))
            .then(() => createTask(4, 3, log))
            .then(() => log.push(`then`))
            .catch(done)

        job.cancel()

        endsWith(
            () => {
                return log.includes('done 1') &&
                    !log.includes('then') &&
                    !log.includes('start 2')
            },
            16, "Promise isn't done or fulfilled")
            .then(() => {
                assert.deepEqual(log, [
                    'start 1',
                    'done 1'
                ])
            })
            .then(done, done)
    })

    it('should accept finalizer', done => {
        const promise = factory(Promise.resolve(), () => { })
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
        factory(Promise.resolve(), () => assert.fail()).then(done)
    })

    it('should return cancellation promise', done => {
        const job = factory(createTask(1, 1))
            .then(() => assert.fail(), assert.fail)
            .catch(done)

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

        const job = factory(createTask(1, 1), finalizer)
            .then(() => assert.fail(), assert.fail)
            .catch(done)

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

        const job = factory(createTask(10, 1), finalizer)
            .then(() => assert.fail(), assert.fail)
            .catch(done)

        job.cancel().catch(done)

        setTimeout(() => {
            job.cancel()
            job.cancel()
            cancelTimerCalled = true
        }, 5)
    })

    it('should call finalizer only after fulfill or reject', done => {
        let promiseDone = false
        const finalizer = () => {
            assert.ok(promiseDone)
            done()
        }

        const task = createTask(10, 1)
            .then(() => promiseDone = true)

        const job = factory(task, finalizer)
            .catch(done)

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

        const job = factory(createTask(1, 1), finalizer)
            .then(() => assert.fail(), assert.fail)
            .catch(done)

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

        const job = factory(createTask(4, 1), finalizer)
            .then(() => fulfilled = true, assert.fail)
            .catch(done)

        setTimeout(() => job.cancel().catch(done), 10)
    })

    it('should handle cancellation rejection', done => {
        const finalizer = () => {
            throw new Error("Test")
        }

        const job = factory(createTask(4, 1), finalizer)
            .catch(done)

        setTimeout(() => job.cancel().catch(() => done()), 10)
    })

    it('should handle synchronous cancellation rejection', done => {
        const finalizer = () => {
            throw new Error("Test")
        }

        const job = factory(createTask(4, 1), finalizer)
            .catch(done)

        job.cancel()
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

        const job = factory(createTask(10, value1), finalizer)
            .then(() => createTask(10, value2))
            .then(() => createTask(10, value3))
            .catch(done)

        setTimeout(() => job.cancel().catch(done), 15)
    })

    it('should call finalizer only with slice of results', done => {
        const value1 = { id: 1 }
        const value2 = { id: 2 }
        const value3 = { id: 3 }

        const finalizer = (arg1, arg2, ...rest) => {
            assert.equal(arg1, value1)
            assert.equal(arg2, value2)
            assert.equal(rest.length, 0)
            done()
        }

        const job = factory(createTask(1, value1), finalizer)
            .then(() => createTask(1, value2))
            .catch(done)

        job.then(() => createTask(1, value3))
            .then(result => {
                assert.equal(result, value3)
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

        const job = factory(createTask(10, value1), finalizer)
            .then(() => createTask(10, value2))
            .catch(done)

        job.then(() => createTask(15, value3))
            .then(() => nextCalled = true, done)

        setTimeout(() => job.cancel().catch(done), 15)
    })

    // TODO finalizer on reject
    // TODO Promise.all, etc
})