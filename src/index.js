/** @module no-thanks */

/**
 * Check that the given object is thenable
 * in other workds has 'then' method
 *
 * @param {*} obj any object
 * @returns {boolean} is object a thenable
 */
const isThenable = obj =>
  typeof obj === "object" && obj != null &&
  "then" in obj && obj.then instanceof Function;

/**
 * Check that the given object is catchable
 * in other workds has 'catch' method
 *
 * @param {*} obj any object
 * @returns {boolean} is object a catchable
 */
const isCatchable = obj =>
  typeof obj === "object" && obj != null &&
  "catch" in obj && obj.catch instanceof Function;

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
  let argNum = n || c.length;
  if (argNum < nf)
    return (...a) =>
      curryInt(f, nf, argNum + a.length).apply(null, c.concat(a));
  else return f(...c);
};

/**
 * Curry function
 *
 * @private
 * @param {Function} f function
 * @returns {Function} curried function
 */
const curry = f => curryInt(f, f.length);

/**
 * Compose two functions first function computes first
 *
 * curried
 * @private
 * @param {Function} f function
 * @param {Function} g function
 * @returns {Function} functional composition
 */
const fcompose = curry((f, g) => (...a) => g(f(...a)));

/**
 * Compose arbitrary number of functions
 *
 * @private
 * @param {Function} fns functions
 * @returns {Function} functinal composition
 */
const pipe = (...args) =>
  args.length - 1 > 0 ? fcompose(args[0], pipe(...args.slice(1))) : args[0];

/**
 * Flatten an itterable
 *
 * @private
 * @param {*} arr array or itterable
 * @returns {Array} flattened array
 */
const flatten = arr =>
  Array.isArray(arr) ? arr.reduce((a, x) => a.concat(flatten(x)), []) : arr;

/**
 * Does nothing
 * @private
 */
const doNothing = () => { };

/**
 * Cancelation context
 *
 * handles current state of the execution and a reference to finalizer
 * @private
 */
class CancellationContext {
  /**
   * @constructor
   * @param {Function} finalizer finalizer to call on cancel
   * @param {boolean} interruptible sets interruptible flag
   */
  constructor(finalizer = null, interruptible = false) {
    this._canceled = false;
    this._finalizer = finalizer != null ? finalizer : doNothing;
    this._finalized = false;
    this._finalizationResolver = null;
    this._interruptible = interruptible;
  }

  /**
   * Check that promises in this context are canceled
   */
  get canceled() {
    return this._canceled;
  }

  /**
   * Checks that the context marked as interruptible
   */
  get interruptible() {
    return this._interruptible;
  }

  /**
   * Cancel promises in context
   */
  cancel() {
    if (!this._canceled) {
      this._canceled = true;
    }
  }

  /**
   * Set the resolver functions to resolve finalization promise later
   *
   * @param {Function} resolve resolve promise
   * @param {Function} reject reject promise
   */
  setFinalizationResolver(resolve, reject) {
    this._finalizationResolver = { resolve, reject };
  }

  /**
   * Call finalizer
   *
   * @returns {*} whatever finalizer returns
   */
  finalize(...results) {
    if (this._canceled && !this._finalized) {
      this._finalized = true;
      try {
        const result = this._finalizer(...results);
        if (this._finalizationResolver != null)
          this._finalizationResolver.resolve(result);
        return result;
      } catch (err) {
        if (this._finalizationResolver != null)
          this._finalizationResolver.reject(err);
        throw err;
      }
    }
  }
}

/**
 * Cancelation chain
 *
 * used internaly to orchestrate cancellation of task's grains
 * @private
 */
class CancellationChain {
  /**
   * @constructor
   * @param {?(cancellationContext|Function)} ctxOrFinalizer finalizer or
   * cancellation context to use
   */
  constructor(ctxOrFinalizer) {
    let ctx;
    if (ctxOrFinalizer instanceof Function)
      ctx = new CancellationContext(ctxOrFinalizer);
    else if (ctxOrFinalizer == null) ctx = new CancellationContext();
    else ctx = ctxOrFinalizer;
    this._ctx = ctx;

    this._results = [];
    this._next = null;
    this._previous = null;
  }

  /**
   * Check that promises in this context are canceled
   */
  get canceled() {
    return this._ctx != null && this._ctx._canceled;
  }

  /**
   * Checks that the underlying context is marked
   * as interruptible
   */
  get interruptible() {
    return this._ctx != null && this._ctx.interruptible;
  }

  /**
   * Add result value to supply it to the finalizer later
   * @param {*} value any
   */
  addResult(value) {
    this._results.push(value);
  }

  /**
   * Cancel promises in context
   */
  cancel() {
    if (this._ctx != null) this._ctx.cancel();
  }

  /**
   * Get or create next context in chain
   *
   * @returns {CancellationContext} next context
   */
  next() {
    if (this._canceled) return null;

    let next = this._getNext();
    if (next != null) return next;

    next = new CancellationChain(this._ctx);
    this._setNext(next);
    next._setPrevious(this);

    return next;
  }
  /**
   * Set the resolver functions to resolve finalization promise later
   *
   * @param {Function} resolve resolve promise
   * @param {Function} reject reject promise
   */
  setFinalizationResolver(resolve, reject) {
    if (this._ctx != null) this._ctx.setFinalizationResolver(resolve, reject);
  }

  /**
   * Call finalizer
   *
   * @returns {*} whatever finalizer returns
   */
  finalize() {
    if (this._ctx != null)
      return this._ctx.finalize(...this._aggregateResults());
  }

  /**
   * Get results of execution
   *
   * @private
   * @returns {Array} results
   */
  _getResults() {
    return this._results;
  }

  /**
   * Set next cancellation context in chain
   *
   * @private
   * @param {CancellationContext} ctx next cancellation context
   */
  _setNext(ctx) {
    this._next = ctx;
  }

  /**
   * Get next cancellation context in chain
   *
   * @private
   * @returns {cancellationContext} next contex
   */
  _getNext() {
    return this._next;
  }

  /**
   * Set previous cancellation context
   *
   * @private
   * @param {CancellationContext} ctx previous cancellation context
   */
  _setPrevious(ctx) {
    this._previous = ctx;
  }

  /**
   * Get next cancellation previous in chain
   *
   * @private
   * @returns {cancellationContext} previous contex
   */
  _getPrevious() {
    return this._previous;
  }

  /**
   * Aggregate the results of all executions
   *
   * @private
   * @returns {Array} results
   */
  _aggregateResults() {
    const results = [this._results];
    let prev = this._getPrevious();
    while (prev != null) {
      results.push(prev._getResults());
      prev = prev._getPrevious();
    }

    return flatten(results.reverse());
  }
}

/**
 * Create "grain" from cancellation context and a value
 *
 * curried
 * @private
 * @param {CancellationContext} ctx cancelabtion context
 * @param {*} value value to wrap
 * @returns {*} wrapped value
 */
const valueGrain = (ctx, value) => {
  if (ctx != null && !ctx.canceled) ctx.addResult(value);

  return value;
};

/**
 * Create "grain" from cancellation context and a promise
 *
 * @private
 * @param {CancellationContext} ctx cancelabtion context
 * @param {Promise} promise promise to wrap
 * @returns {Promise} wrapped promise
 */
const promiseGrain = (ctx, promise) =>
  new Promise((resolve, reject) => {
    const noContext = ctx == null;
    if (noContext || !ctx.canceled) {
      promise
        .then(result => {
          if (!noContext) ctx.addResult(result);
          if (noContext || !ctx.canceled) resolve(result);
          else if (!noContext) ctx.finalize();
        })
        .catch(err => {
          if (noContext || !ctx.canceled) reject(err);
        });
    } else if (!noContext) ctx.finalize();
  });

/**
 * Create "grain" from cancellation context and a resolver
 *
 * @private
 * @param {CancellationContext} ctx cancelabtion context
 * @param {Function} resolver resolver to wrap
 * @returns {Promise} wrapped resolver
 */
const resolverGrain = (ctx, resolver) => (resolve, reject) => {
  const noContext = ctx == null;
  if (noContext || !ctx.canceled) {
    resolver(
      result => {
        if (!noContext) ctx.addResult(result);
        if (noContext || !ctx.canceled) resolve(result);
        else if (!noContext) ctx.finalize();
      },
      err => {
        if (noContext || !ctx.canceled) reject(err);
      }
    );
  } else if (!noContext) ctx.finalize();
};

/**
 * Create "grain" from cancellation context and an arbitrary value
 *
 * curried
 * @private
 * @param {CancellationContext} ctx cancelabtion context
 * @param {*} value value to wrap
 */
const grain = curry((ctx, value) =>
  // only native promises, not thenables
  (value instanceof Promise ? promiseGrain : valueGrain)( 
    ctx,
    value
  )
);

/**
 * Cancellable promise - Promise that can be canceled
 * @alias module:no-thanks
 */
class CancellablePromise extends Promise {
  /**
   * @constructor
   * @param {Function|Object} resolver promise resolver
   * or promise-like value
   * @param {?(Function|CancellationContext)} ctxOrFinalizer  finalizer or
   * cancellation context to use. If nothing was provided
   * then a new context will be created
   */
  constructor(resolver, ctxOrFinalizer = null) {
    let ctx;
    if (ctxOrFinalizer instanceof Function)
      ctx = new CancellationChain(ctxOrFinalizer);
    else if (ctxOrFinalizer instanceof CancellationChain) ctx = ctxOrFinalizer;
    else if (ctxOrFinalizer == null) ctx = new CancellationChain();
    else
      throw new Error(`Unrecognized type of the second argument of 
the CacnellablePromise constructor`);

    if (isThenable(resolver) && isCatchable(resolver))
      super(grain(ctx, resolver).then.bind(resolver));
    else if (resolver instanceof Function) super(resolverGrain(ctx, resolver));
    else
      throw new Error(`\
Resolver must be either a function or a Promise. \
Probably the function provided to the cancelable(...) is not an AsyncFunction`);

    this._ctx = ctx;
  }

  /**
   * @inheritdoc
   */
  then(onFulfill, onReject) {
    const ctx = this._getContext();
    const nextCtx = ctx != null ? ctx.next() : null;
    onFulfill = this._wrapOnFulfillHandler(onFulfill, nextCtx);
    onReject = this._wrapOnRejectHandler(onReject);
    return this._next(super.then(onFulfill, onReject), nextCtx);
  }

  /**
   * @inheritdoc
   */
  catch(onReject) {
    onReject = this._wrapOnRejectHandler(onReject);
    const ctx = this._getContext();
    const nextCtx = ctx != null ? ctx.next() : null;
    return this._next(super.catch(onReject), nextCtx);
  }

  /**
   * Cancel this promise, the promise will not be interrupted by this call
   * but the result (or error) of it will be muted
   *
   * @returns {Promise} cancellation result
   */
  cancel() {
    const ctx = this._getContext();
    if (ctx == null) return;

    if (!ctx.canceled) {
      ctx.cancel();
      return this._finalize();
    } else return Promise.resolve();
  }

  /**
   * Call finalizer
   * @returns {Promise} cancellation promise
   */
  _finalize() {
    const ctx = this._getContext();
    if (ctx == null) return Promise.resolve();

    /* eslint-disable require-jsdoc */
    const call = (resolve, reject) => {
      try {
        resolve(ctx.finalize());
      } catch (err) {
        reject(err);
      }
    };

    if (!ctx.interruptible) {
      return new Promise((resolve, reject) => {
        ctx.setFinalizationResolver(resolve, reject);
        const handler = () => call(resolve, reject);
        super.then(handler, handler);
      });
    } else return new Promise(call);
    /* eslint-enable require-jsdoc */
  }

  /**
   * Get current cancellation context
   *
   * @private
   * @returns {CancellationContext} context
   */
  _getContext() {
    return this._ctx;
  }

  /**
   * Set cancellation context to use
   *
   * @private
   * @param {CancellationContext} ctx context
   * @returns {CancellablePromise} this
   */
  _setContext(ctx) {
    this._ctx = ctx;
    return this;
  }

  /**
   * Set the given cancellable promise to use
   * the current cancellation context
   *
   * @private
   * @param {CancellablePromise} promise promise
   * @param {CancellationChain} nextCtx cancellation context chain to use
   * @returns {CancellablePromise} provided promise
   */
  _next(promise, nextCtx) {
    promise._setContext(nextCtx);
    return promise;
  }

  /**
   * Wrap fulfillment handler
   *
   * @private
   * @param {Function} handler fulfillment handler
   * @param {CancellationChain} nextCtx cancellation context chain to use
   * @returns {Function} wrapped fulfillment handler
   */
  _wrapOnFulfillHandler(handler, nextCtx) {
    return handler != null
      ? value => {
        const ctx = this._getContext();
        const noContext = ctx == null;

        if (noContext || !ctx.canceled) {
          if (handler == null) return;
          const next = handler(value);
          if (isThenable(next) && isCatchable(next))
            return grain(nextCtx, next);
          else {
            if (nextCtx != null && !nextCtx.canceled) nextCtx.addResult(next);
            return next;
          }
        } else if (!noContext) ctx.finalize();
      }
      : handler;
  }

  /**
   * Wrap rejection handler
   *
   * @private
   * @param {Function} handler rejection handler
   * @returns {Function} wrapped rejection handler
   */
  _wrapOnFinallyHandler(handler) {
    return handler != null
      ? () => {
        const ctx = this._getContext();

        const noContext = ctx == null;
        if (noContext || !ctx.canceled) {
          if (handler == null) return;
          const next = handler();
          return next;
        } else if (!noContext) ctx.finalize();
      }
      : handler;
  }

  /**
   * Wrap finalization handler
   *
   * @private
   * @param {Function} handler rejection handler
   * @returns {Function} wrapped rejection handler
   */
  _wrapOnRejectHandler(handler) {
    return handler != null
      ? err => {
        const ctx = this._getContext();
        if (handler == null) return;

        if (ctx == null || !ctx.canceled) {
          const next = handler(err);
          return next;
        }
      }
      : handler;
  }
}

/**
 * Wrap promise into cancellable promise with
 * the given cancellation context
 *
 * curried
 * @private
 * @param {CancellationContext} ctx cancellation context
 * @param {Promise} promise promise to wrap
 * @returns {CancellablePromise} cancellable promise
 */
const patch = curry((ctx, promise) => new CancellablePromise(promise, ctx));

/**
 * Wrap any type task, using the given wrapper
 *
 * @private
 * @param {*} task task
 * @param {Function} wrapper wrapper function to call with context
 * @returns {*} whatever wrapper returns
 */
const granulateValue = (task, wrapper) => wrapper(() => task);

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
  wrapper(ctx => (fineGrained ? task(grain(ctx), ...args) : task(...args)));

/**
 * Wrap task of arbitrary type, using the given wrapper
 *
 * @private
 * @param {?*} task task
 * @param {boolean} fineGrained suply "grain" function to
 * the task function or not
 * @param {Function} wrapper wrapper function to call with context
 * @returns {*} whatever wrapper returns
 */
const granulate = (task, fineGrained, wrapper) => {
  if (task instanceof Function)
    return granulateFunction(task, fineGrained, wrapper);
  else if (task != null) return granulateValue(task, wrapper);
  else return granulateValue(Promise.resolve(), wrapper);
};

/**
 * Create cancellable task
 *
 * @alias module:no-thanks
 * @param {(Promise|AsyncFunction)} task task to make cancellable
 * @param {?Function} finalizer finalizer to call after cancel
 * @param {?boolean} fineGrained supply "grain" function to the
 * given task, if the task has a type of AsyncFunction
 * @returns {CancellablePromise} cancellable promise
 */
const cancellable = (task, finalizer = null, fineGrained = true) =>
  !(task instanceof CancellablePromise)
    ? granulate(task, fineGrained, createTopGrain => {
      const ctx = new CancellationChain(finalizer);

      return pipe(createTopGrain, patch(ctx))(ctx);
    })
    : task;

/**
 * Create interruptible task
 *
 * @alias module:no-thanks
 * @param {(Promise|AsyncFunction)} task task to make interruptible
 * @param {?Function} finalizer finalizer to call on interrupt
 * @param {?boolean} fineGrained supply "grain" function to the
 * given task, if the task has a type of AsyncFunction
 * @returns {CancellablePromise} interruptible promise
 */
const interruptible = (task, finalizer = null, fineGrained = true) =>
  !(task instanceof CancellablePromise)
    ? granulate(task, fineGrained, createTopGrain => {
      const ctx = new CancellationChain(
        new CancellationContext(finalizer, true)
      );

      return pipe(createTopGrain, patch(ctx))(ctx);
    })
    : task;

/**
 * Create promise from generator
 *
 *
 * @private
 * @param {CancellationContext} ctx cancellation context
 * @param {Iterator} iterator iterator
 * @returns {Promise} promise
 */
const runIterator = (ctx, iterator) => {
  try {
    const { value, done } = iterator.next();
    if (!done) {
      if (isThenable(value) && isCatchable(value))
        return value.then(result => {
          if (ctx != null && !ctx.canceled) ctx.addResult(result);
          return runIterator(ctx, iterator);
        });
      else {
        if (ctx != null && !ctx.canceled) ctx.addResult(value);
        return runIterator(ctx, iterator);
      }
    } else return Promise.resolve(value);
  } catch (err) {
    return Promise.reject(err);
  }
};

/**
 * Create promise from generator, stopping iteration
 * if context is canceled
 *
 * @private
 * @param {CancellationContext} ctx cancellation context
 * @param {Iterator} iterator iterator
 * @returns {Promise} promise
 */
const runFineGrainedIterator = (ctx, iterator) => {
  const noContext = ctx == null;
  if (noContext || !ctx.canceled) {
    try {
      const { value, done } = iterator.next();
      if (noContext || !ctx.canceled) {
        if (!done) {
          if (isThenable(value) && isCatchable(value))
            return value.then(result => {
              if (ctx != null && !ctx.canceled) ctx.addResult(result);
              return runFineGrainedIterator(ctx, iterator);
            });
          else {
            if (ctx != null && !ctx.canceled) ctx.addResult(value);
            return runFineGrainedIterator(ctx, iterator);
          }
        } else {
          // if (ctx != null && !ctx.canceled)
          // ctx.addResult(value)
          return Promise.resolve(value);
        }
      } else if (!noContext) ctx.finalize();
    } catch (err) {
      return Promise.reject(err);
    }
  } else if (!noContext) ctx.finalize();
};

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
    const iterator = task(...args);
    if (iterator == null || !iterator.next)
      throw new Error(`\
The function provided to the coroutine is not a Generator Function`);

    return fineGrained
      ? runFineGrainedIterator(ctx, iterator)
      : runIterator(ctx, iterator);
  });

/**
 * Create cancellable promise from generator that yields other promises
 *
 * @alias module:no-thanks
 * @param {Generator} generator generator to make cancellable
 * @param {?Function} finalizer finalizer function to call on cancel
 * @param {?boolean} fineGrained stop iteration on cancel or not
 * @returns {CancellablePromise} cancellable promise
 */
const coroutine = (generator, finalizer = null, fineGrained = true) =>
  granulateGenerator(generator, fineGrained, createTopGrain => {
    const ctx = new CancellationChain(finalizer);

    return pipe(createTopGrain, patch(ctx))(ctx);
  });

/**
 * Wraps a promise into another to safelly return
 * it from async functions, then methods and resolvers.
 * Stops javascript from performing automatic chaining
 *
 * @param {Promise|Object} promise any value to wrap
 * @returns {Promise} wrapped promise
 */
const compose = promise => Promise.resolve({ promise });

/**
 * Handler to unwrap a value previously wrapped with compose
 *
 * @param {Object} param wrapped value
 * @returns {Promise} unwrapped promise
 */
const decompose = ({ promise }) =>
  new Promise((resolve, reject) => {
    promise.then(resolve, reject);
  });

module.exports = {
  CancellablePromise,
  cancellable,
  interruptible,
  coroutine,
  compose,
  decompose
};
