Steller is a small framework for building composeable sound models in
Javascript using the [Web Audio API]. It features a `GraphNode` abstraction
that encapsulates dynamic signal flow graphs, `Param` objects to add 
parameters of various kinds to objects and a `Scheduler` for sequencing
audio events just in time. These classes are all available under the
namespace `org.anclab.steller`.

Examples -

1. See [Gurur Brahma](http://sriku.org/demos/gurur/) for a fairly sophisticated
   example of using Steller to present a simple chant melody with precisely
   synchronized animations.
2. [Tala Player](http://talakeeper.org/talas.html) is a free player for the
   various Carnatic tala patterns. The visualization and the sound are both
   expressed using a single steller composition.

[Web Audio API]: https://dvcs.w3.org/hg/audio/raw-file/tip/webaudio/specification.html

## GraphNode

Encapsulates a sub-graph between a set of input nodes and a set of output
nodes. The two primary methods it adds are -

- `connect(targetGraphNode, outPinIx, inPinIx)`
- `disconnect(targetGraphNode, outPinIx)`

*Usage*: `var obj = org.anclab.steller.GraphNode(obj, [in1, in2, ...], [out1, out2, ...])` where
`obj` is an object to turn into a `GraphNode`, `inX` are input nodes and `outY`
are output nodes (either `AudioNode` objects or `GraphNode`s).

## Param

`Param` objects encapsulate dynamic parameters to sound models and provide some basic
glue functionality such as watching for changes and binding to HTML UI elements.

*Usage*: `org.anclab.steller.Param(spec)` creates a `Param` object.

- `obj.param = Param({min: 0, max: 100, value: 50})`
- `obj.param = Param({min: 0, max: 100, audioParam: anAudioParam})`
- `obj.param = Param({options: ["one", "two", "three"], value: "one"})`
- `obj.param.watch(function (value, param) {...});`
- `obj.param.unwatch(aPreviouslyInstalledCallback)`
- `obj.param.changed()` forces observer notification.
- `obj.param.bind(elem, optional<Scheduler>)`
- `obj.param.unbind(elem)`
- `Param.names(obj)` gets names of all exposed params in `obj`


Ex:

    obj.griffinStrength = Param({min: 0, max: 100, value: 20});
    obj.griffinStrength.value = 40;
    console.log(obj.griffinStrength.valueOf()); // Prints 40.
    console.log(obj.griffinStrength.value);     // Prints 40.
    obj.griffinStrength.bind('#strength'); // Binds to a slider described using a document.querySelector string.

## SoundModel

A sound model is just an alias for a graph node. Ok not quite. It is
a grpah node, but with the `connect` and `disconnect` calls observable.

This is available as `org.anclab.steller.SoundModel`.

Usage: `var sm = org.anclab.steller.SoundModel(obj, [inputs..], [outputs..]);`

- `sm.on('connect', function () { console.log('connected'); })`
- `sm.on('disconnect', function () { console.log('disconnected'); })`


## Scheduler

A just-in-time scheduler for continuous temporal behaviour. It threads a clock
object through sequential events part of a single "track". Multiple `track`s
can be `spawn`ed or `fork`ed in parallel and each can have its own clock
object.  The clock object tracks both absolute time and a rate integrated
pseudo time that can be used for things like tempo changes. The complexity of
the scheduler is proportional to the number of simultaneously running tracks.

*Usage*: `var sh = new org.anclab.steller.Scheduler(audioContext);`

Here is [a bare bones demo] of using the scheduler.

[a bare bones demo]: http://srikumarks.github.com/steller

You use the methods of the scheduler object to make specifications or "models" and call
`sh.play(s)` to play a built specification.

- `sh.audioContext` gives the audio context whose time base is used for
  scheduling.
- `sh.cancel()` cancels all scheduled processes.
- `sh.play(model)` causes the given model to be played now. 
- `sh.stop` is a model that will cause the track in which it occurs to
  terminate.
- `sh.cont` is a model that is a no-op when encountered in a track.
- `sh.track(model1, model2, ...)` makes a sequence for performing the given
  models one after another.
- `sh.slice(aTrack, startIndex, endIndex)` makes a "slice" of the given track
  that can be played independently.
- `sh.delay(dur, [callback])` will cause the models that follow a `delay` in a
  sequence to occur at a later time.  If a `callback` is specified, it will be
  called like `callback(clock, t1r, t2r, startTime, endTime)` for every "tick"
  of the scheduler until the delay finishes. This is useful to perform timed
  animations.
- `sh.loop(model)` makes a model that will loop the given model forever, thus
  never terminating until a `stop` is encountered.
- `sh.loop_while(flag, model)` makes a model that will loop as long as the
  given `flag.valueOf()` is truthy. Once it becomes falsy, the loop terminates
  and continues on to the action that follows it in a sequence.
- `sh.repeat(n, model)` makes a model that will repeat `model` the given `n` 
  number of times.
- `sh.fork(model1, model2, ..)` causes all the given models to start in
  "parallel" and waits for them to finish before continuing.
- `sh.spawn(model1, model2, ...)` like `fork` causes all the given models to
  start in "parallel", but doesn't wait for them to finish.
- `sh.dynamic(function (clock) { return model; })` makes a "dynamic model" that
  will behave like whatever `model` the given function returns, at the time the
  dynamic model gets to run. You can code up temporal recursion using `dynamic` 
  like this -

```js
    var callback = sh.dynamic(function (clock) {
        // 1. Make some noise at clock.t1
        // 2. Schedule ourselves into the future.
        return sh.track([sh.delay(0.5), callback]);
    });
```

- `sh.fire(function (clock) {...})` will cause the given callback to be called
  at the time the model is performed. The resultant action itself has zero
  duration.
- `sh.anim(param, duration, v1, v2)` animates the parameter from value `v1` to
  value `v2` over the given `duration` using linear interpolation.
- `sh.anim(param, duration, function (t) { return value; })` will assign the
  return value of the given function (whose time argument is normalized to
  `[0,1]` range) to the parameter over the given duration.
- `sh.anim(param, duration, v1, v2, function (t1) { return t2; })` will use the
  given interpolation function (domain  = `[0,1]`, range = `[0,1]`) to generate
  parameter value s between `v1` and `v2`.
- `sh.rate(r)` changes the rate of passage of pseudo time through the track in
  which it occurs to the given `r`. `r = 1` means that the virtual time is
  itself in seconds.
- `sh.choice(models)` makes a model that will randomly behave like one of the
  models in the given array every time it is invoked. This is a simple use of
  `dynamic`.
- `sh.sync()` makes a synchronizer that can be used to mark various points
  within a composition where a particular model's playback can be synced.

```js
    var s1 = sh.sync();
    var trk = sh.track([model1, model2, ..., s1, ... modelN]);
    sh.play(trk); // Start playing the track.
    s1.play(model); // Will cause model to play when trk gets to s1.
```

- `sh.gate()` makes an action that can be used to pause/resume at certain
  points within a composition. This is useful for context dependent
  pause/resume support.

```js
    var g1 = sh.gate();
    var trk = sh.track([model1, model2, ..., g1, ... modelN]);
    sh.play(trk); // Start playing the track.
    g1.close(); // Pause when the play back gets to g1.
    g1.open(); // Resume if paused at g1, otherwise equivalent to sh.cont.
```

The following operators are available for working with visual actions. Audio
may be computed a little ahead of time that may span a few visual frames. These
functions account for that difference and try to schedule the visual actions
as close to the actual render time as possible. These visual actions can be
scheduled alongside audio actions in the same composition.

- `sh.display(function (clock, scheduledTime, currentTime) {...})` will call
  the given callback at the appropriate time for the visual display to occur.
  The `display()` action itself takes zero duration just like `fire`.
- `sh.frame(function (clock) {...})` schedules rendering a single visual frame
  and lasts as long - i.e. the following action will run only after the frame
  computation completes. Consecutive `frame()` actions result in frame by frame
  synced animation.
- `sh.frames(duration, function (clock) {...})` schedules an animation sequence
  that lasts for the given duration. It accounts for the fact that any
  following audio computations may need to be done a little before the visual
  animation finishes.

If `sh.ontick` is set to a `function (t) {...}`, then it will be called for
every scheduler tick at the end of all other operations. This is useful for
2D/3D draw flush operations.
