# No Thanks!
### Fine-grained cancelation for promises

The **no-thanks** package provides a set of **utilities for promise cancellation** that can be used as a **primitives** to compose more complex pipelines with the ability to stop execution at any time

`npm i --save no-thanks`

Quick links:
 * [Documentation](doc/)
 * [API Reference](doc/reference.md)
 * [Release Notes](https://github.com/vacavaca/no-thanks/releases)

In case the website is down all the documentation can be found in the [doc directory](https://github.com/vacavaca/no-thanks/tree/master/doc) of the source repository 

## Motivation

It's a very common situation when a javascript program has to run some expensive or long-running task and then the result of the task or the task itself is no longer needed.

As an example, an application may start a **network request** (or a group of requests) and then the user clicks "Cancel" button or changes some parameters so we need to abort the request and drop the result.

Standard javascript APIs such as **Promise** or **AsyncFunction** has no way to stop a task, neither has a tool to **split the task into smaller ones** and stop them in a more 
*granular* way.

This library provides such tools, along with a cancellation callbacks to free up resources after cancel.

## Getting Started

```js
const { CancellablePromise, cancellable, coroutine } = require('no-thanks')
```

### Basic Usage

`CancellablePromise` is a `Promise` that can be canceled. It extends native `Promise` for full compatibility

> *class* **CancellablePromise** *(**task**: Function|Promise, **finalizer**: ?Function = null)* extends *Promise*
 
The very basic usage of it:

```js
let job = new CancellablePromise(someTask);

// or alternativelly:
job = cancellable(someTask);

/* ... */

job.cancel()
```

When the `cancel` method is called while the `someTask` is not finished, fulfillment value or the rejection of it will be muted and will not be propagated further.

If `someTask` has finished execution before the `cancel` method was called, the cancellation has no effect, but the finalizer (if given) will be called anyway. 

**Note** `CacnellablePromise` constructor and `cancellable` function are interchangeable except the *fineGrained* parameter that will be discussed a bit later

### Finalization

`CancellablePromise` constructor or `cancellable` function can be called with a callback that will be called after cancel.

This callback is responsible for a finalization of the task, it's often used to do some cleanup when a task was canceled.

The finalizer will be called with the results of promises that are already fulfilled at the time of cancel

```js
// CancellablePromise constructor can also be used here
const job = cancellable(someTask, taskResult => { 
    console.log('finalization')
})
    
/* ... */

job.cancel()

// outputs:
// > finalization
```

Because **finalizer is called asynchronously** `cancel` method of the `CacnellablePromise` returns a `Promise` with the result of finalizer call. If the finalizer returns promise it will be automatically chained into a cancellation result promise

```js
const job = cancellable(someTask, () => Promise.resolve(42))

job.cancel()
    .then(answer => console.log(answer))

// prints: 42

```

**Note** that the finalizer will be called after `cancel()` in any case, even if the wrapped promise was successfully fulfilled with a value or rejected


### Fine-grained cancellation

To create a cancellable pipeline of promises just call `.then` and `.catch` methods of `CancellablePromise`, then the resulting promise can be canceled in the middle of execution 

```js
// CancellablePromise constructor can also be used here
const job = cancellable(task1, (result1, resul2, result3) => {
        console.log('canceled', result1, result2, result3)
    })
    .then(() => task2)
    .then(() => task3)

/* ... wait for task1 to complete and task2 to start */

job.cancel()

// outputs:
// > canceled resul1 result2 undefined

```

Note that only first two tasks was executed

### Async Function

The cancellation of an `AsyncFunction` is controlled with special argument "**fineGrained**": `boolean` in the `cancellable` signature:

> **cancellable** *(**task**: AsyncFunction|Promise, **finalizer**: ?Function = null, **fineGrained**: boolean = true)* => `CancellablePromise`

When it's set to true (default) additional argument will be given to the task function, this argument is used to wrap inner tasks into *"grains"* to make them cancellable. The argument will be provided at the first position and it's usually named "grain"


```js
const job = cancellable(async (grain, ...args) => {
    await grain(task1)
    /* do other stuff */
    await grain(task2)
    await grain(42) // any value can be wrapped into grain, and passed to the finalizer
    await grain(task3)

    console.log(...agrs)
    /// prints: the answer is 42
})

// run the job
const cancellable = job('the', 'answer', 'is', 42)

/* ... */

cancellable.cancel()
```


### Coroutine

To avoid unnecessary verbosity with a **grain** argument from the previous example, a generator can be used instead of `AsyncFunction`. The library provides the **coroutine** method for that. It takes a generator function as an argument and wraps it into a `CancellablePromise`.

This approach сould be used to run a set of independent tasks sequentially, but if the next task in pipeline somehow depends on the result of the previous one, then `cancellable` method should be used. 

> **coroutine** *(**generator**: Generator Function, **finalizer**: ?Function = null, **fineGrained**: boolean = true)* => `CancellablePromise`

Optionally it takes **finalizer** as the second argument, and **fineGrained** as the third, if the **fineGrained** is set to true (default) then all the `Promise`s that generator yields will be wrapped into *grains*, like in the previous example:

```js
const job = coroutine(function* (...args) {
    yield task1
    /* do other stuff */
    yield task2
    yield task3

    console.log(...args)
    // prints: the answer is 42
})

const cancellable = job('the', 'answer', 'is', 42)

/* ... */

cancellable.cancel()
```

That was the last method of the public API, you can find more examples and recipes [here](doc/recipes.md)

Also, take a look at the [test directory](https://github.com/vacavaca/no-thanks/tree/master/test), it contains **a lot** of examples of different semantics of the library methods

# License

MIT

See [LICENSE](https://github.com/vacavaca/no-thanks/blob/master/LICENSE) to see the full text.

---

All notable changes are documented in the [CHANGELOG.md](https://github.com/vacavaca/no-thanks/blob/master/CHANGELOG.md) file.

This package can also be found at:
 * [npm](https://www.npmjs.com/package/no-thanks)

# About the Author

I'm a web-developer, based in ~700 km south of the Arctic Circle in the beautiful city of Saint-Petersburg.

Feel free to contact me by [email](mailto:vacavaca@fastmail.com)