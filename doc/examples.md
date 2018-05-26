# Examples


Suppose we have some expensive and long-running work separated in tasks.

Each task has a `name` and a couple of `console.log`s so we can track its' execution:

```js
const createTask = (timeout, name) => new Promise(resolve => { 
    console.log(`start ${name} task`)
    setTimeout(() => {
        console.log(`done ${name} task`)
        resolve(name)
    }, timeout)
}

```


## Setup

```js
const { CancellablePromise, cancellable, coroutine } = require('no-thanks')
```

---

## CancellablePromise

```js
    const task = createTask(100, 'first')
```

[CancellablePromise](reference/cancellable-promise.md) can be created with the [cancellable](reference/cancellable.md) factory function:


```js
    let job = cancellable(task)

    // ...or using the constructor:
    job = new CancellablePromise(task)
```

The `cancellable` function and the constructor of the `CancellablePromise` are interchangeable except the third `fineGrained` parameter of the `cancellable` function that will be discussed later in this section.

---

#### Cancel task immediatelly
```js
const job = cancellable(task)
    .then(result => console.log(`result of ${result} task`))

job.cancel()
```

output:
```
> start first task
... 100ms delay
> done first task
```

The task was started because execution of resolver in Promises starts immediately and synchronously, but the result of the task was not propagated further

---

#### Cancel task after a delay
```js
const job = cancellable(task)
    .then(result => console.log(`result: ${result}`))

setTimeout(() => job.cancel(), 50)
```

output:
```
> start first task
... 100ms delay
> done first task
```

---

```js
const job = cancellable(task)
    .then(result => console.log(`result: ${result}`))

setTimeout(() => job.cancel(), 150)
```

output:
```
> start first task
... 100ms delay
> done first task
> result first
```

Promise was successfully fulfilled before its' cancel method was called