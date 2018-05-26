/** @module no-thanks */

/**
 * Curry function
 * (recursive variant)
 * 
 * @private
 * @param {Function} f function
 * @param {number} nf function length
 * @param {number} n number of supplied arguments
 * @returns {*} next function or result
 */
const curryInt = (f, nf, n = 0) => (...c) => {
    n = n || c.length
    if (n < nf) return (...a) =>
        curryInt(f, nf, n + a.length).apply(null, c.concat(a))
    else return f(...c)
}

/**
 * Curry function
 * 
 * @private
 * @param {Function} f function
 * @returns {Function} curried function
 */
const curry = f => curryInt(f, f.length)

/**
 * Compose two functions first function computes first
 *
 * curried
 * @private
 * @param {Function} f function
 * @param {Function} g function
 * @returns {Function} functional composition
 */
const compose = curry((f, g) => (...a) => g(f(...a)))

/**
 * Compose arbitrary number of functions
 * 
 * @private
 * @param {Function} fns functions
 * @returns {Function} functinal composition
 */
const pipe = (...args) =>
    (args.length - 1 > 0 ? compose(args[0], pipe(...args.slice(1))) : args[0])

/**
 * Does nothing
 * @private
 */
const doNothing = () => { }

/**
 * Cancelation context
 * 
 * used internaly to orchestrate cancellation of task's grains
 * @private
 */
class CancelationContext {
    /**
     * @constructor
     * @param {Function} finalizer finalizer to call on cancel
     */
    constructor(finalizer = null) {
        this._canceled = false
        this._finalizer = finalizer != null ? finalizer : doNothing
        this._finalized = false
        this._results = []
    }

    /**
     * Check that promises in this context are canceled
     */
    get canceled() {
        return this._canceled
    }

    /**
     * Add result value to supply it to the finalizer later
     * @param {*} value any
     */
    addResult(value) {
        this._results.push(value)
    }

    /**
     * Cancel promises in context
     */
    cancel() {
        if (!this._canceled)
            this._canceled = true
    }

    /**
     * Run finalizer
     */
    finalize() {
        if (this._canceled && !this._finalized) {
            this._finalized = true
            this._finalizer(...this._results)
        }
    }
}

/**
 * Cancellable promise - Promise that can be canceled
 * @alias module:no-thanks
 */
class CancellablePromise extends Promise {
    /**
     * @constructor
     * @param {Function} resolver promise resolver
     * @param {(Function|CancelationContext|undefined)} ctx cancellation context
     * or finalizer to use. If nothing was provided 
     * then a new context will be created
     */
    constructor(resolver, ctx = null) {
        if (resolver instanceof Promise) super(resolver.then.bind(resolver))
        else if (resolver instanceof Function) super(resolver)
        else throw new Error(`\
Resolver must be either a function or a Promise. \
Probably the function provided to the cancelable(...) is not an AsyncFunction`)

        if (ctx instanceof Function) ctx = new CancelationContext(ctx)
        else if (ctx == null) ctx = new CancelationContext()
        this._ctx = ctx
    }

    /**
     * @inheritdoc
     */
    then(onFulfill, onReject) {
        onFulfill = this._wrapOnFulfillHandler(onFulfill)
        onReject = this._wrapOnRejectHandler(onReject)
        return this._next(super.then(onFulfill, onReject))
    }

    /**
     * @inheritdoc
     */
    catch(onReject) {
        onReject = this._wrapOnRejectHandler(onReject)
        return this._next(super.catch(onReject))
    }

    /**
     * @inheritdoc
     */
    finaly(onFinally) {
        onFinally = this._wrapOnFinallyHandler(onFinally)
        return this._next(super.finally(onFinally))
    }

    /**
     * Cancel this promise, the promise will not be interrupted by this call
     * but the result (or error) of it will be muted
     * 
     * @returns {Promise} cancellation result
     */
    cancel() {
        const ctx = this._getContext()
        if (ctx != null)
            ctx.cancel()

        /* eslint-disable require-jsdoc */
        const call = (resolve, reject) => {
            try {
                resolve(ctx.finalize())
            } catch (err) {
                reject(err)
            }
        }

        return new Promise((resolve, reject) => {
            const handler = () => call(resolve, reject)
            Promise.prototype.then.call(this, handler, handler)
        })
        /* eslint-enable require-jsdoc */
    }

    /**
     * Get current cancellation context
     * 
     * @private
     * @returns {CancelationContext} context
     */
    _getContext() {
        return this._ctx
    }


    /**
     * Set cancellation context to use
     * 
     * @private
     * @param {CancelationContext} ctx context
     * @returns {CancellablePromise} this
     */
    _setContext(ctx) {
        this._ctx = ctx
        return this
    }

    /**
     * Set the given cancellable promise to use
     * the current cancellation context
     * 
     * @private
     * @param {CancellablePromise} promise promise
     * @returns {CancellablePromise} provided promise
     */
    _next(promise) {
        promise._setContext(this._getContext())
        return promise
    }

    /**
     * Wrap fulfillment handler
     * 
     * @private
     * @param {Function} handler fulfillment handler
     * @returns {Function} wrapped fulfillment handler
     */
    _wrapOnFulfillHandler(handler) {
        return handler != null ? value => {
            const ctx = this._getContext()
            if (ctx != null) ctx.addResult(value)
            if (handler == null) return

            const noContext = ctx == null
            if (noContext || !ctx.canceled) {
                const next = handler(value)
                if (next instanceof Promise)
                    return new CancellablePromise(next, this._getContext())
                else return next
            } else if (!noContext) ctx.finalize()
        } : handler
    }

    /**
     * Wrap rejection handler
     * 
     * @private
     * @param {Function} handler rejection handler
     * @returns {Function} wrapped rejection handler
     */
    _wrapOnFinallyHandler(handler) {
        return handler != null ? () => {
            const ctx = this._getContext()
            if (handler == null) return

            const noContext = ctx == null
            if (noContext || !ctx.canceled) {
                const next = handler()
                if (next instanceof Promise)
                    return new CancellablePromise(next, this._getContext())
                else return next
            } else if (!noContext) ctx.finalize()
        } : handler
    }

    /**
     * Wrap finalization handler
     * 
     * @private
     * @param {Function} handler rejection handler
     * @returns {Function} wrapped rejection handler
     */
    _wrapOnRejectHandler(handler) {
        return handler != null ? err => {
            const ctx = this._getContext()
            if (handler == null) return

            if (ctx == null || !ctx.canceled) {
                const next = handler(err)
                if (next instanceof Promise)
                    return new CancellablePromise(next, this._getContext())
                else return next
            }
        } : handler
    }
}

/**
 * Wrap promise into cancellable promise with
 * the given cancellation context
 * 
 * curried
 * @private
 * @param {CancelationContext} ctx cancellation context
 * @param {Promise} promise promise to wrap
 * @returns {CancellablePromise} cancellable promise
 */
const patch = curry((ctx, promise) =>
    new CancellablePromise(promise, ctx))

/**
 * Create "grain" from cancellation context and promise
 * 
 * curried
 * @private
 * @param {CancelationContext} ctx cancelabtion context
 */
const grain = curry((ctx, promise) =>
    new Promise((resolve, reject) => {
        const noContext = ctx == null
        if (noContext || !ctx.canceled) {
            promise
                .then(result => {
                    if (!noContext) ctx.addResult(result)
                    if (noContext || !ctx.canceled) resolve(result)
                    else if (!noContext) ctx.finalize()

                }).catch(err => {
                    if (noContext || !ctx.canceled) reject(err)

                })
        } else if (!noContext) ctx.finalize()
    }))

/**
 * Wrap any type task, using the given wrapper
 * 
 * @private
 * @param {*} task task
 * @param {Function} wrapper wrapper function to call with context
 * @returns {*} whatever wrapper returns
 */
const granulateValue = (task, wrapper) => wrapper(() => task)

/**
 * Wrap function type task, using the given wrapper
 * 
 * @private
 * @param {(Function|AsyncFunction)} task task
 * @param {boolean} fineGrained suply "grain" function to
 * the task function or not
 * @param {Function} wrapper wrapper function to call with context
 * @returns {*} whatever wrapper returns
 */
const granulateFunction = (task, fineGrained, wrapper) => (...args) =>
    wrapper(ctx => fineGrained ? task(grain(ctx), ...args) : task(...args))

/**
 * Wrap task of arbitrary type, using the given wrapper
 * 
 * @private
 * @param {*} task task
 * @param {boolean} fineGrained suply "grain" function to
 * the task function or not
 * @param {Function} wrapper wrapper function to call with context
 * @returns {*} whatever wrapper returns
 */
const granulate = (task, fineGrained, wrapper) => {
    if (task instanceof Function)
        return granulateFunction(task, fineGrained, wrapper)
    else return granulateValue(task, wrapper)
}

/**
 * Create cancellable task
 * 
 * @alias module:no-thanks
 * @param {(Promise|AsyncFunction|Function)} task task to make cancellable
 * @param {?Function} finalizer finalizer to call after cancel
 * @param {?boolean} fineGrained supply "grain" function to the 
 * given task, if the task has a type of Function
 * @returns {CancellablePromise} cancellable promise
 */
const cancellable = (task, finalizer = doNothing, fineGrained = true) =>
    !(task instanceof CancellablePromise)
        ? granulate(task, fineGrained, createTopGrain => {
            const ctx = new CancelationContext(finalizer)

            return pipe(
                createTopGrain,
                patch(ctx)
            )(ctx)
        })
        : task

/**
 * Create promise from generator
 * 
 * 
 * @private
 * @param {CancelationContext} ctx cancellation context
 * @param {Iterator} iterator iterator
 * @returns {Promise} promise 
 */
const runIterator = (ctx, iterator) => {
    try {
        const { value, done } = iterator.next()
        if (!done) {
            if (value instanceof Promise) return value.then(result => {
                if (ctx != null) ctx.addResult(result)
                return runIterator(ctx, iterator)
            })
            else return runIterator(iterator)
        } else return Promise.resolve(value)
    } catch (err) {
        return Promise.reject(err)
    }
}


/**
 * Create promise from generator, stopping iteration
 * if context is canceled
 * 
 * @private
 * @param {CancelationContext} ctx cancellation context
 * @param {Iterator} iterator iterator
 * @returns {Promise} promise 
 */
const runFineGrainedIterator = (ctx, iterator) => {
    const noContext = ctx == null
    if (noContext || !ctx.canceled) {
        try {
            const { value, done } = iterator.next()
            if (noContext || !ctx.canceled) {
                if (!done) {
                    if (value instanceof Promise) return value.then(result => {
                        if (ctx != null) ctx.addResult(result)
                        return runFineGrainedIterator(ctx, iterator)
                    })
                    else return runFineGrainedIterator(ctx, iterator)
                } else return Promise.resolve(value)
            } else if (!noContext) ctx.finalize()
        } catch (err) {
            return Promise.reject(err)
        }
    } else if (!noContext) ctx.finalize()
}

/**
 * Wrap generator task, using the given wrapper
 * 
 * @private
 * @param {Generator} task task
 * @param {boolean} fineGrained stop iteration on cancel or not
 * @param {Function} wrapper wrapper function to call with context
 * @returns {*} whatever wrapper returns
 */
const granulateGenerator = (task, fineGrained, wrapper) => (...args) =>
    wrapper(ctx => {
        const iterator = task(...args)
        return fineGrained
            ? runFineGrainedIterator(ctx, iterator)
            : grain(ctx, runIterator(ctx, iterator))
    })

/**
 * Creates cancellable promise from generator that yields other promises
 * 
 * @alias module:no-thanks
 * @param {Generator} generator generator to make cancellable
 * @param {?Function} finalizer finalizer function to call on cancel 
 * @param {?boolean} fineGrained stop iteration on cancel or not
 * @returns {CancellablePromise} cancellable promise
 */
const coroutine = (generator, finalizer = doNothing, fineGrained = true) =>
    granulateGenerator(generator, fineGrained, createTopGrain => {
        const ctx = new CancelationContext(finalizer)

        return pipe(
            createTopGrain,
            patch(ctx)
        )(ctx)
    })

module.exports = {
    CancellablePromise, cancellable, coroutine
}