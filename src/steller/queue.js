// A simple Queue class with the intention to minimize
// memory allocation just for the sake of queue processing.

function Queue(name) {
    var length = 0, maxLength = 4, store = [null,null,null,null], removeAt = -1, addAt = 0;


    // Add an element to the queue.
    function add(x) {
        if (length >= maxLength) {
            // Grow store
            var newStore = new Array(maxLength * 2);
            var i, j, N, M;
            for (i = removeAt, j = 0, N = length, M = maxLength; j < N; ++j, i = (i + 1) % M) {
                newStore[j] = store[i];
            }
            store = newStore;
            addAt = length;
            removeAt = length === 0 ? -1 : 0;
            maxLength *= 2;
        }

        // Add element.
        store[addAt] = x;
        if (removeAt < 0) {
            removeAt = addAt;
        }
        addAt = (addAt + 1) % maxLength;

        return this.length = length = (length + 1);
    }

    // Remove an element from the queue.
    // Throws an exception when the queue is empty.
    function remove() {
        if (length <= 0) {
            throw new Error('Empty queue');
        }

        var x = store[removeAt];
        store[removeAt] = null; // Needed for garbage collector friendliness.
        removeAt = (removeAt + 1) % maxLength;
        this.length = length = (length - 1);

        return x;
    }

    // Remove all elements. The `optFn` is a function that, if given,
    // will be invoked on all the queued elements before they're dumped
    // from the queue. You can use this to do cleanup actions. 
    //
    // WARNING: Within the optFn, you cannot call add/remove/clear of this
    // queue. Calling them will raise a "Method not available" error.
    function clear(optFn) {
        if (optFn) {
            if (typeof(optFn) !== 'function') {
                throw new Error("Queue: Argument to clear, if given, must be a function.");
            }

            // Protect against calling other methods during the
            // optFn calls.
            this.add = this.remove = this.clear = methodNotAvailable;

            for (let i = 0; i < length; ++i) {
                try {
                    if (store[i]) {
                        optFn(store[i]);
                    }
                } catch (e) {
                    // Swallow exceptions.
                    console.error("BAD PROGRAMMER ERROR: Cleanup functions for scheduler models should not throw.");
                }
            }

            this.add = add;
            this.remove = remove;
            this.clear = clear;
        }
        
        this.length = length = 0;
        store.splice(0, store.length, null, null, null, null);
        maxLength = 4;
        removeAt = -1;
        addAt = 0;
    }

    function methodNotAvailable() {
        throw new Error('Method not available');
    }

    // Length is kept up to date.
    this.length = 0;

    this.add = add;
    this.remove = remove;
    this.clear = clear;

    return this;
}

module.exports = Queue;
