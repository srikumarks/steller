// A simple Queue class with the intention to minimize
// memory allocation just for the sake of queue processing.
function Queue(name) {
    var length = 0,
        maxLength = 4,
        store = [null,null,null,null],
        removeAt = -1,
        addAt = 0;


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

    // Remove all elements.
    function clear() {
        this.length = length = 0;
        store.splice(0, store.length, null, null, null, null);
        maxLength = 4;
        removeAt = -1;
        addAt = 0;
    }

    // Length is kept up to date.
    this.length = 0;

    this.add = add;
    this.remove = remove;
    this.clear = clear;

    return this;
}


