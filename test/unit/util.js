const util = require('util')

/**
 * Schedule a function call with the given scheduler
 * 
 * @param {Function} scheduler scheduler
 * @param {Function} fn function to call
 * @returns {Promise} promise of execution of the function
 */
const schedule = (scheduler, fn) =>
    new Promise((resolve, reject) => scheduler(() => {
        try {
            const result = fn()
            resolve(result)
        } catch (err) {
            reject(err)
        }
    }))

/**
 * Promise version of setTimeout
 * 
 * @param {number} timeout delay in ms
 * @param {?Function} fn function to run after the delay
 * @returns {Promise} promise for the function call
 */
const delay = (timeout, fn = () => { }) =>
    schedule(p => setTimeout(p, timeout), fn)

/**
 * Helper function to test if the given predicate becomes
 * true after some time
 * 
 * @param {Function} test predicate function
 * @param {number} lag timeout in ms
 * @param {?string} message error message
 * @returns {Promise} promise
 */
const endsWith = (test, lag = 0, message = 'Timeout') =>
    delay(lag, () => {
        if (!test())
            throw new Error(message)
    })



let lock = null
let currentDone = null

process.on('unhandledRejection', (reason, p) => {
    if (currentDone != null) {
        const message = `\
Unhandled Rejection: ${reason}\n\tat: ${util.inspect(p)}`
        currentDone(new Error(message))
    }
})

/**
 * Wrap test case and handle unhandled promise 
 * rejections within it
 * 
 * @param {Function} test test case
 * @returns {Function} wrapped test case
 */
const checkUnhandledRejections = test => done => {
    if (lock == null) {
        let doneCalled = false
        /* eslint-disable require-jsdoc */
        currentDone = err => {
            if (!doneCalled) {
                doneCalled = true
                done(err)
            }
        }
        /* eslint-enable require-jsdoc */
        test(currentDone)
    } else lock.then(() => {
        lock = null
        checkUnhandledRejections(test)(done)
    }, () => {
        lock = null
        checkUnhandledRejections(test)(done)
    })
}

const patchItToCheckUnhandledRejections = () => {
    const bufferIt = it
    const itCheckingRejections = (name, test) =>
        bufferIt(name, test != null ? checkUnhandledRejections(test) : test)

    for (const k of Object.keys(bufferIt)) {
        itCheckingRejections[k] = (name, test) =>
            bufferIt[k](name, checkUnhandledRejections(test))
    }

    return itCheckingRejections
}

module.exports = {
    schedule,
    delay,
    endsWith,
    checkUnhandledRejections,
    patchItToCheckUnhandledRejections
}
