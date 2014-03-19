var Queue = require('./queue'),
    Param = require('./param'),
    PeriodicTimer = require('./periodictimer'),
    JSNodeTimer = require('./jsnodetimer'),
    Clock = require('./clock'),
    Util = require('./util');

//
// ## Scheduler
//
// This is a scheduler for "models" .. which are functions
// of the form --
// 
//      function (sched, clock, next) {
//           // ... do something
//           next(sched, clock, sched.stop); // Go to the next one (optional).
//       }
//
// where --
// 
//   - `sched` is the scheduler object.
//   - `clock` is the clock object containing absolute and rate integrated 
//     time information for this interval.
//   - `next` is the model that is supposed to follow this one in time.
// 
// To use the scheduler, you first make an instance using "new".
//
//      var sh = new Scheduler;
//
// Then you start it running by setting the 'running' property to true.
//
//      sh.running = true;
//
// Then you can play models already. Here is something that will keep
// outputting 'fizz', 'buzz' alternately every 2 seconds.
//
//      var dur = Param({min: 0.01, max: 60, value: 2});
//      var fizzbuzz = sh.loop(sh.track([
//          sh.log('fizz'), sh.delay(dur),
//          sh.log('buzz'), sh.delay(dur)
//      ]));
//      sh.play(fizzbuzz);
// 
// Now try changing the value of the duration parameter p.dur like below
// while the fizzes and buzzes are being printed out --
//      
//      dur.value = 1
//
function Scheduler(audioContext, options) {
    /* Make sure we don't clobber the global namespace accidentally. */
    var self = (this === window ? {} : this);
    var Timer = PeriodicTimer; // or JSNodeTimer

    // We need requestAnimationFrame when scheduling visual animations.
    var requestAnimationFrame = Util.getRequestAnimationFrameFunc();

    var AudioContext = Util.getAudioContext();

    if (Util.detectBrowserEnv() && !requestAnimationFrame) {
        throw new Error('Scheduler needs requestAnimationFrame support. Use a sufficiently modern browser version.');
    }

    /* How long is an "instant"? */
    var instant_secs = 0.001;

    /* Wrap Date.now() or audioContext.currentTime as appropriate.
     * The scheduler supports both mechanisms for tracking time. */
    var time_secs = (function () {
        if (!audioContext) {
            return Util.getHighResPerfTimeFunc() || (function () { return Date.now() * 0.001; });
        } else if (audioContext.createGain || audioContext.createGainNode) {
            instant_secs = 1 / audioContext.sampleRate;
            audioContext.createGain = audioContext.createGainNode = (audioContext.createGain || audioContext.createGainNode);
            audioContext.createGainNode();  // Looks useless, but it gets the
            // audioContext.currentTime running.
            // Otherwise currentTime continues to
            // be at 0 till some API call gets made,
            // it looks like.

            return function () {
                return audioContext.currentTime;
            };
        } else {
            throw new Error("Scheduler: Argument is not an audio context");
        }
    }());


    var timer, running = false;

    // To start the scheduler, set "scheduler.running = true"
    // To stop it, set it to false.
    self.__defineGetter__('running', function () { return running; });
    self.__defineSetter__('running', function (state) {
        if (state) {
            if (!running) {
                running = true;
                mainClock.advanceTo(time_secs());
                if (playNow.activeFunc) {
                    playNow = playNow.activeFunc;
                    play = play.activeFunc;
                }
                timer.start();
            }
        } else {
            running = false;
            timer.stop();
            playNow = (function (playNow) {
                function inactivePlayNow(model) {
                    schedule(model);
                };
                inactivePlayNow.activeFunc = playNow;
                return inactivePlayNow;
            }(playNow));
            play = (function (play) {
                function inactivePlay(model) {
                    schedule(function () { play(model); });
                }
                inactivePlay.activeFunc = play;
                return inactivePlay;
            }(play));
        }
    });

    // A frame rate observer that gets updated once in a while.
    // If you want to update a display when frame rate changes,
    // add a watcher.
    self.frame_rate = Param({min: 15, max: 75, value: 60});

    // Scheduled actions are placed in an event tick queue. The queue is
    // processed on each `scheduleTick()`.  A pair of arrays used as the
    // event tick queue.  Models placed in queue are processed and the
    // resultant models scheduled go into the requeue. Then after one such
    // cycle, the variables are swapped.
    var queue = new Queue('tick');

    // The frame queue is for running visual frame calculations after
    // the normal scheduling loop has finished. This runs *every*
    // scheduleTick.
    var fqueue = new Queue('frames');

    // Update queue. This can be used to synchronize parameter changes.
    var uqueue = new Queue('update');

    // Cancels all currently running actions.
    function cancel() {
        uqueue.clear();
        queue.clear();
        fqueue.clear();
    }

    // `scheduleTick` needs to be called with good solid regularity.
    // If we're running the scheduler under node.js, it can only
    // be because MIDI is needed, which needs high precision,
    // indicated by 0. The `PeriodicTimer` and `JSNodeTimer` encapsulate
    // this timing functionality required.
    timer = new Timer(scheduleTick, 0, audioContext);

    /* Keep track of time. */
    var kFrameInterval = 1/60;
    var kFrameAdvance = kFrameInterval;
    var clockDt = timer.computeAheadInterval_secs || 0.05; // Use a 60Hz time step.
    var clockBigDt = clockDt * 5; // A larger 10Hz time step.
    var mainClock = new Clock(time_secs(), 0, clockDt, 1.0);
    var compute_upto_secs = mainClock.t1;
    var advanceDt = 0.0;

    // A simple mechanism to adjust the "frame rate". Normally, this
    // shouldn't be necessary, but given that we're operating audio and
    // visuals in the same framework, the notion of a steady frame rate is
    // needed to predict when to render stuff and how much further to
    // compute. We compute audio 3 callbacks ahead of time.
    //
    // runningFrameInterval is the low pass filtered frame interval. The
    // time constant of the filter is of the order of a second, so that
    // instantaneous changes to frame rate don't disrupt the rate for just
    // a few frames.
    var adaptFrameInterval = (function () {
        var runningFrameInterval = 1/60;
        var lastTickTime_secs = mainClock.t1;

        // Steller can periodically update the 'frame_rate' property
        // (which is actually a Param). You can watch it for changes
        // if you want.
        var frUpdateInterval = 15;
        var frUpdateCounter = frUpdateInterval;

        return function (t) {
            // Adjust the notion of frame interval if the going rate is smooth.
            var frameDt = t - lastTickTime_secs;
            if (frameDt > 0.01 && frameDt < 0.07) {
                runningFrameInterval += 0.05 * (frameDt - runningFrameInterval);
                kFrameAdvance = kFrameInterval = runningFrameInterval;
                clockDt = 3.33 * kFrameInterval;
                clockBigDt = clockDt * 5;
                if (frUpdateCounter-- <= 0) {
                    self.frame_rate.value = Math.round(1/kFrameInterval);
                    frUpdateCounter = frUpdateInterval;
                }
            }

            lastTickTime_secs = t;
        };
    }());

    /* Main scheduling work happens here.  */
    function scheduleTick() {
        var i, N, t, length, f, a, once = true;
        t = time_secs();

        adaptFrameInterval(t);

        // Determine target time up to which we need to compute.
        compute_upto_secs = t + clockDt;

        /* If lagging behind, advance time before processing models. */
        while (t - mainClock.t1 > clockBigDt) {
            advanceDt = t - mainClock.t1;
            mainClock.advance(advanceDt);
        }

        while (once || mainClock.t1 < compute_upto_secs) {
            if (uqueue.length > 0) {
                length = uqueue.length;
                for (i = 0; i < length; ++i) {
                    uqueue.remove()();
                }
            }

            // Process no more than the existing number of elements
            // in the queue. Do not process any newly added elements
            length = queue.length;

            /* Process the scheduled tickers. The tickers
             * will know to schedule themselves and for that
             * we pass them the scheduler itself.
             */
            for (i = 0; i < length; ++i) {
                queue.remove()(self, mainClock, cont);
            }

            if (mainClock.t1 < compute_upto_secs) {
                mainClock.tick();
            }

            advanceDt = 0.0;
            once = false;
        }

        if (fqueue.length > 0) {
            length = fqueue.length;

            for (i = 0; i < length; i += 2) {
                f = fqueue.remove();
                a = fqueue.remove();
                f(t, a);
            }
        }

        // Finally, if there is an ontick handler installed, we call
        // that for every tick, passing it the current time.
        if (self.ontick) {
            self.ontick(t);
        }
    }

    // Schedules the model by placing it into the processing queue.
    function schedule(model) {
        if (model) {
            queue.add(model);
        }
    }

    // Schedules a "frame computation" which will run every scheduleTick
    // regardless of how much ahead the rest of the scheduler is running.
    //
    // f is expected to be a function and will be called with no arguments.
    function scheduleFrame(f, info) {
        if (f) {
            fqueue.add(f);
            fqueue.add(info);
        }
    }

    // Makes sure f is called before the next schedule.
    function scheduleUpdate(f) {
        if (f) {
            uqueue.add(f);
        }
    }

    // ### perform
    //
    // Wraps the concept of "performing" a model so that
    // the representation of the model as a continuation 
    // is not strewn all over the place. 
    function perform(model, clock, next) {
        model(self, clock, next);
    }

    // ### play
    //
    // Having constructed a model, you use play() to play it.
    // The playing starts immediately. See `delay` below if you want
    // the model to start playing some time in the future.
    function playNow(model) {
        model(self, mainClock.copy().jumpTo(time_secs()), stop);
    }

    var play = (function () {
        if (audioContext) {
            /* waitForAudioClockStartAndPlay will play the given model only
             * after the audio clock has advanced beyond zero.  This can
             * take some time on iOS6. This is necessary for Web Audio API
             * on iOS6. Sadly, as of this writing, (22 Sep 2012), this
             * technique is sufficient only for iOS6 on iPhone4. Safari on
             * iPad doesn't work even with this wait in place. 
             */
            return function waitForAudioClockStartAndPlay(model) {
                if (audioContext.currentTime === 0) {
                    setTimeout(waitForAudioClockStartAndPlay, 100, model);
                } else {
                    mainClock = new Clock(time_secs(), 0, clockDt, 1.0);
                    compute_upto_secs = mainClock.t1;
                    self.play = play = playNow;
                    playNow(model);
                }
            };
        } else {
            return playNow;
        }
    }());

    // ### stop
    //
    // This "model" says "stop right here, nothing more to do."
    // This is the "zero" of the algebra. No model placed after a stop
    // in a sequence will get to run.
    function stop(sched, clock, next) {
    }

    // ### cont
    //
    // This "model" just says "continue on with whatever's next".
    // This is the "one" of the algebra. Placing it anywhere in
    // a sequence has no consequence on it.
    function cont(sched, clock, next) {
        if (next) {
            next(sched, clock, stop);
        }
    }

    // ### delay
    //
    //      delay(dt)
    //      delay(dt, function (clock, t1r, t2r, startTime, endTime) {...})
    //
    // Gives a model that introduces the given amount of delay in a
    // sequence. Notice that the "valueOf" protocol on dt is used. This
    // lets us introduce fixed as well as variable delays. This is the
    // absolute *core* of the "scheduler" since it is the only function
    // which actually does something about invoking stuff at a specified
    // time! Any optimization of the scheduling loop will also involve this
    // function and, likely, this one *only*.
    //
    // Example:
    //
    //      sh.play(sh.track(sh.delay(1), model))
    //
    // Will cause the model to play after 1 second.
    //
    // If callback is provided, it will be called throughout the wait
    // period with the arguments (t1, t2, startTime, endTime) giving the
    // interval for which it is being called. Continuous parameter
    // animations can be handled using the callback, for example.
    function delay(dt, callback) {
        return function (sched, clock, next) {
            var startTime = clock.t1r;

            function tick(sched, clock) {
                var endTime = startTime + dt.valueOf();

                // If lagging behind, advance time before processing models.
                // If, say, the user switched tabs and got back while
                // the scheduler is locked to a delay, then all the pending
                // delays need to be advanced by exactly the same amount.
                // The way to determine this amount is to keep track of
                // the time interval between the previous call and the
                // current one. That value is guaranteed to be the same
                // for all delays active within a single scheduleTick().
                //
                // Furthermore, the delay needs to be cryo-frozen frozen
                // during the lapse and then thawed when the playback
                // resumes. This also entails adjustment of the startTime
                // and endTime so everything stays in sync. This results in
                // an adjustment of the "past" of the delay to be consistent
                // with the present and the future.
                if (advanceDt > 0.0 && clock.t1 < mainClock.t1) {
                    clock.advance(advanceDt);
                }

                if (clock.t1 > compute_upto_secs) {
                    // We're already ahead of time. Wait before
                    // computing further ahead.
                    schedule(poll);
                    return;
                }

                if (clock.t2r < endTime) {
                    if (callback) {
                        callback(clock, clock.t1r, clock.t2r, startTime, endTime);
                    }
                    clock.tick();
                    schedule(poll);
                } else {
                    if (callback && endTime >= clock.t1r) {
                        callback(clock, clock.t1r, endTime, startTime, endTime);
                    }
                    if (clock.t2r > clock.t1r) {
                        next(sched, clock.nudgeToRel(endTime), stop);
                    } else {
                        next(sched, clock, stop);
                    }
                }
            }

            function poll(sched) {
                tick(sched, clock, stop);
            }

            tick(sched, clock);
        };
    }

    // ### seq (internal)
    //
    // The two given models will be performed in sequence.
    // When the first model ends, it will transfer control
    // to the second model. 
    //
    // Note: This is an internal combinator exposed via the
    // more convenient "track".
    function seq(model1, model2) {
        return function (sched, clock, next) {
            model1(sched, clock, seq(model2, next));
        };
    }

    // ### loop
    //
    // Here is a model that will never end. The given model
    // will be looped forever. You better have a delay in 
    // there or you'll get an infinite loop or blow the stack
    // or something like that.
    function loop(model) {
        return function looper(sched, clock, next) {
            model(sched, clock, looper);
        };
    }

    // ### loop_while(flag, model)
    //
    // Keeps executing model in a loop as long as flag.valueOf() is truthy.
    function loop_while(flag, model) {
        return function (sched, clock, next) {

            function loopWhileFlag() {
                if (flag.valueOf()) {
                    model(sched, clock, loopWhileFlag);
                } else {
                    next(sched, clock, stop);
                }
            }

            loopWhileFlag();
        };
    }

    // ### repeat(n, model)
    //
    // Produces a model that, when played, repeats the model `n` times.
    // This means that the duration of the resultant model will be
    // n times the duration of the given model (if it is a constant).
    function repeat(n, model) {
        return function (sched, clock, next) {
            var counter = 0;

            function repeatNTimes() {
                if (counter < n) {
                    counter++;
                    model(sched, clock, repeatNTimes);
                } else {
                    next(sched, clock, stop);
                }
            }

            repeatNTimes();
        };
    }

    // ### fork
    //
    // The models in the given array are spawned off simultanously.
    // When all the models finish their work, the fork will
    // continue on with whatever comes next.
    //
    //  Ex: 
    //
    //      sh.play(sh.track(sh.fork([drumpat1, drumpat2]), drumpat3));
    //
    // That will cause pat1 to be played simultaneously with pat2
    // and when both finish, pat3 will play.
    //
    // Supports both `fork(a, b, c, ..)` and `fork([a, b, c, ..])` forms.
    //
    function fork(models) {
        if (models && models.constructor === Function) {
            /* We're given the models as arguments instead of an array. */
            models = Array.prototype.slice.call(arguments, 0);
        } else {
            models = models.slice(0);
        }
        return function (sched, clock, next) {
            var syncCount = 0;
            function join(sched, clockJ) {
                syncCount++;
                if (syncCount === models.length) {
                    /* All models have finished. */
                    next(sched, clock.syncWith(clockJ), stop);
                }
            }

            /* Start off all models. */
            models.forEach(function (model) {
                model(sched, clock.copy(), join);
            });
        };
    }

    // ### spawn
    //
    // Similar to `fork`, except that the `spawn` will immediately
    // continue on with whatever is next, as though its duration
    // is zero.
    //
    // Supports both `spawn(a, b, c, ..)` and `spawn([a, b, c, ..])` forms.
    function spawn(models) {
        if (models && models.constructor === Function) {
            /* We're given the models as arguments instead of an array. */
            models = Array.prototype.slice.call(arguments, 0);
        } else {
            models = models.slice(0);
        }
        return function (sched, clock, next) {
            models.forEach(function (model) {
                model(sched, clock.copy(), stop);
            });
            next(sched, clock, stop);
        };
    }

    // ### dynamic
    //
    // A generic 'dynamic model', which determines the
    // model to use at any given time according to some
    // rule. 'dyn' is a `function (clock)` and is expected
    // to return a model, which is then scheduled. You can
    // use this, for example, to do random choices, conditional
    // choices, etc.
    function dynamic(dyn) {
        return function (sched, clock, next) {
            dyn(clock)(sched, clock, next);
        };
    }

    // ### track
    //
    // Produces a model that consists of a sequence of
    // the given models (given as an array of models).
    // 
    // `track([a,b,c,d])` is just short hand for
    // `seq(a, seq(b, seq(c, d)))`
    //
    // Supports both `track(a, b, c, ..)` and `track([a, b, c, ..])` forms.
    //
    // Note that the intermediate continuations are one-shot
    // and are not reusable for the sake of performance.
    function track(models) {
        if (models && models.constructor === Function) {
            /* We're given the models as arguments instead of an array. */
            models = Array.prototype.slice.call(arguments, 0);
        }

        function track_iter(sched, clock, next, startIndex, endIndex) {
            // The extra arguments are used by slice() to provide a playback
            // range for a given track. When the arguments are not given,
            // the whole track is played. Use track_iter.minIndex and maxIndex
            // to determine valid values for the index range.
            var i = 0, i_end = models.length;

            if (arguments.length > 3) {
                ASSERT(arguments.length === 5);
                i = startIndex;
                i_end = endIndex;
            }

            function iter(sched, clock, _) {
                if (i < i_end) {
                    models[i++](sched, clock, iter);
                } else {
                    next(sched, clock, stop);
                }
            }

            iter(sched, clock, next);
        }

        // minIndex and maxIndex give the range of possible index values
        // for the track. The range is [minIndex, maxIndex).
        track_iter.minIndex = 0;
        track_iter.maxIndex = models.length;
        track_iter.models = models;

        return track_iter;
    }

    // ### slice(aTrack, startIndex, endIndex)
    //
    // Makes an action that will play the given slice of the track.
    // The `aTrack` is created using the `track()` method.
    // The given indices are constrained by the track's index range
    // as specified by aTrack.minIndex and aTrack.maxIndex.
    // 
    // If you want control of a track or a slice *while* it is playing,
    // you need to build synchronization mechanisms into it yourself.
    // See `sync()` and `gate()`.
    function slice(aTrack, startIndex, endIndex) {
        endIndex = (arguments.length > 2 ? endIndex : aTrack.maxIndex);
        startIndex = (arguments.length > 1 ? Math.max(aTrack.minIndex, Math.min(startIndex, endIndex)) : aTrack.minIndex);
        return function (sched, clock, next) {
            aTrack(sched, clock, next, startIndex, endIndex);
        };
    }

    // ### fire
    //
    // A model that simply fires the given call at the right time, takes
    // zero duration itself and moves on.
    var fire;
    if (options && options.diagnostics) {
        LOG(4, "fire: diagnostics on");
        fire = function (callback) {
            return function (sched, clock, next) {
                var t = time_secs();
                WARNIF(clock.t1 < t, "fire: late by " + Math.round(1000 * (t - clock.t1)) + " ms");
                callback(clock);
                next(sched, clock, stop);
            };
        };
    } else {
        fire = function (callback) {
            return function (sched, clock, next) {
                callback(clock);
                next(sched, clock, stop);
            };
        };
    }

    // ### display
    //
    // Very similar to fire(), except that the given callback will be
    // called for the next visual frame. Consecutive display()s in a
    // track will result in their callbacks being bunched.
    //
    //      callback(clock, scheduledTime, currentTime)
    function display(callback) {
        return function (sched, clock, next) {
            var t1 = clock.t1;

            function show(t) { 
                if (t + kFrameAdvance > t1) {
                    callback(clock, t1, t); 
                } else {
                    // Not yet time to display it. Delay by one
                    // more frame.
                    scheduleFrame(show);
                }
            }

            scheduleFrame(show);
            next(sched, clock, stop);
        };
    }

    // ### frame
    // 
    // Similar to fire() and display(), but actually lasts one frame
    // duration.  So consecutive frame() actions in a track can be used for
    // frame by frame animation. The frame will be delayed at the time at
    // which it actually needs to be displayed. The scheduler runs
    // computations a little bit into the future so this may need the frame
    // to be delayed by a few frames. The clock will always advance by one
    // frame duration between two consecutive frames.
    //
    // Due to the "sync to time" behaviour of frame(), the very first frame
    // in a sequence may be delayed by more than one frame. Subsequent
    // frames will occur (typically) with a single frame delay.
    //
    // The callback will receive a clock whose `t1` field is exactly the
    // same as the current time.
    function frame(callback) {
        return function (sched, clock, next) {
            var t1 = clock.t1;

            function show(t) {
                if (t + kFrameAdvance > t1) {
                    clock.jumpTo(t);
                    callback(clock);
                    next(sched, clock, stop);
                } else {
                    // Delay by one more frame. Keep doing this
                    // until clock syncs with the real time.
                    scheduleFrame(show);
                }
            }

            scheduleFrame(show);
        };
    }

    // ### frames(duration, callback)
    //
    // Couples a regular delay with a scheduled series of callbacks for
    // visual animation. The animation calls occur forked relative to the
    // main schedule and will sync to real time irrespective of the amount
    // of "compute ahead" used for audio. Therefore the following actions
    // may begin to run a little before the requested series of callbacks
    // finish. However, if the following action is also a frames(), then 
    // that will occur strictly (?) after the current frames() finishes,
    // due to the "sync to real time" behaviour.
    //
    // Responds live to changes in `duration` if it is a parameter.
    function frames(dt, callback) {
        return function (sched, clock, next) {
            var startTime = clock.t1r;
            var animTime = startTime;
            var animTimeAbs = clock.t1;
            var animTick, animInfo;

            if (callback) {
                animTick = function (t, info) {
                    if (info.intervals.length > 0) {
                        var t1 = info.intervals[0], t1r = info.intervals[1], t2r = info.intervals[2], r = info.intervals[3];
                        if (t1r <= info.endTime) {
                            if (t1 < kFrameAdvance + t) { 
                                callback(info.clock, t1r, t2r, info.startTime, info.endTime, r);
                                info.intervals.splice(0, 4);
                            }
                            scheduleFrame(animTick, info);
                            return;
                        } else {
                            // Animation ended.
                        }
                    }

                    if (!info.end) {
                        scheduleFrame(animTick, info);
                    }
                };

                animInfo = {clock: clock, intervals: [], startTime: clock.t1r, endTime: clock.t1r + dt.valueOf(), end: false};
                scheduleFrame(animTick, animInfo);
            }

            function tick(sched, clock) {
                var i, N, dtr, step;
                var endTime = startTime + dt.valueOf();

                // If lagging behind, advance time before processing models.
                // If, say, the user switched tabs and got back while
                // the scheduler is locked to a delay, then all the pending
                // delays need to be advanced by exactly the same amount.
                // The way to determine this amount is to keep track of
                // the time interval between the previous call and the
                // current one. That value is guaranteed to be the same
                // for all delays active within a single scheduleTick().
                //
                // Furthermore, the delay needs to be cryo-frozen frozen
                // during the lapse and then thawed when the playback
                // resumes. This "cryo" is achieved by only adjusting the
                // real time and leaving the rate integrated time untouched.
                // That implies that "logically" nothing happened during the
                // advance - i.e. the world skipped some seconds, without
                // leaving a trace!
                if (advanceDt > 0.0 && clock.t1 < mainClock.t1) {
                    clock.advance(advanceDt);

                    if (animInfo) {
                        animTimeAbs += step;

                        if (animInfo.intervals.length > 4) {
                            // Leave only one frame in the queue intact.
                            animInfo.intervals.splice(0, animInfo.intervals.length - 4);
                        }

                        if (animInfo.intervals.length > 0) {
                            animInfo.intervals[0] += step;
                            animInfo.intervals[3] = clock.rate.valueOf();
                        }
                    }
                }

                if (clock.t1 > compute_upto_secs) {
                    // We're already ahead of time. Wait before
                    // computing further ahead.
                    schedule(poll);
                    return;
                }

                if (animInfo && clock.t1r <= endTime) {
                    animInfo.endTime = endTime;
                    var frozenRate = clock.rate.valueOf();
                    dtr = Math.max(0.001, kFrameInterval * frozenRate);
                    while (animTime < clock.t2r) {
                        animInfo.intervals.push(animTimeAbs);
                        animInfo.intervals.push(animTime);
                        animInfo.intervals.push(animTime + dtr);
                        animInfo.intervals.push(frozenRate);
                        animTime += dtr;
                    }
                }

                if (clock.t2r < endTime) {
                    clock.tick();
                    schedule(poll);
                } else {
                    if (animInfo) {
                        animInfo.end = true;
                    }
                    if (clock.t2r > clock.t1r) {
                        next(sched, clock.nudgeToRel(endTime), stop);
                    } else {
                        next(sched, clock, stop);
                    }
                }
            }

            function poll(sched) {
                tick(sched, clock, stop);
            }

            tick(sched, clock);
        };
    }

    // ### log
    //
    // Useful logging utility.
    function log(msg) {
        return fire(function () {
            console.log(msg);
        });
    }

    // ### Parameter animation curves.
    //
    // #### anim(param, dur, func)
    // func is expected to be a function (t) where t is 
    // in the range [0,1]. The given parameter will be assigned
    // the value of the function over the given duration.
    //
    // #### anim(param, dur, v1, v2)
    // The parameter will be linearly interpolated over the given duration
    // starting with value v1 and ending with v2.
    //
    // #### anim(param, dur, v1, v2, interp)
    // The parameter will be interpolated from value v1 to value v2
    // over the given duration using the given interpolation function
    // interp(t) whose domain and range are both [0,1].
    //
    // #### Notes
    //
    // Note that animation curves have a duration so that you
    // can sequence different curves using track().
    // If you want a bunch of parameters to animate simultaneously,
    // you need to use spawn() or fork().
    //
    // Also remember that the "dur" parameter can be anything
    // that supports "valueOf" protocol. That said, be aware that
    // varying the duration can result in the parameter jumping
    // values due to large changes in the fractional time. Sometimes,
    // that might be exactly what you want and at other times that
    // may not be what you want.
    function anim(param, dur) {
        var v1, v2, func, afunc;
        switch (arguments.length) {
            case 3: /* Third argument must be a function. */
                afunc = arguments[2];
                break;
            case 4: /* Third and fourth arguments are starting
                     * and ending values over the duration. */
                v1 = arguments[2];
                v2 = arguments[3];
                afunc = function (f) { 
                    return (1 - f ) * v1.valueOf() + f * v2.valueOf(); 
                };
                break;
            case 5: /* Third and fourth are v1, and v2 and fifth is
                     * a function(fractionalTime) whose return value is
                     * in the range [0,1] which is remapped to [v1,v2].
                     * i.e. the function is an interpolation function. */
                v1 = arguments[2];
                v2 = arguments[3];
                func = arguments[4];
                afunc = function (frac) { 
                    var f = func(frac);
                    return (1 - f) * v1.valueOf() + f * v2.valueOf();
                };

                break;
            default:
                throw new Error("Invalid arguments to anim()");
        }

        if (param.constructor.name === 'AudioGain' || param.constructor.name === 'AudioParam') {
            // Use linear ramp for audio parameters.
            return delay(dur, function (clock, t1, t2, startTime, endTime) {
                var dt = endTime - startTime;
                var t1f, t2f;
                if (t1 <= startTime) {
                    t1f = dt > instant_secs ? (t1 - startTime) / dt : 0;
                    param.setValueAtTime(afunc(t1f), clock.rel2abs(t1));
                }

                t2f = dt > instant_secs ? (t2 - startTime) / dt : 1;
                param.linearRampToValueAtTime(afunc(t2f), clock.rel2abs(t2));
            });
        } else {
            return delay(dur, function (clock, t1, t2, startTime, endTime) {
                // When animating a parameter, we need to account for the
                // fact that we're generating only one value for the
                // parameter per call. This means the first call should
                // have a fractional time of 0 and the last one should have
                // a fractional time of 1. We can make that happen if we
                // assume that t2-t1 stays constant.
                //
                // The ideal behaviour would be to generate two values for
                // each call and have the audio engine interpolate between
                // them. The technique below serves as a stop-gap
                // arrangement until then.
                var dt = endTime - startTime - (t2 - t1);
                if (dt > instant_secs) {
                    param.value = afunc((t1 - startTime) / dt);
                } else {
                    // If we're generating only one value because the
                    // animation duration is very short, make it 
                    // the final value.
                    param.value = afunc(1);
                }
            });
        }
    }

    // ### rate
    //
    // Changes the rate of progress of time through delays.  The given rate
    // "r" can be anything that supports the valueOf() protocol. The rate
    // value/parameter will flow along with the clock object that arrives
    // at this point - meaning it will affect all events that occur
    // sequenced with the rate control action. Note that fork() and spawn()
    // copy the clock before propagating. This means that each track within
    // a spawn/fork can have its own rate setting and that won't interfere
    // with the others. However, if you set a rate in the track that
    // contains the fork/spawn (and before them), the rate setting will
    // propagate to all the forked tracks by virtue of the clock copy.
    //
    // You need to be aware of whether the rate is being propagated "by
    // reference" or "by value". If the rate is a parameter, it gets
    // propagated by reference - i.e. changing the *value* of the rate
    // parameter in one track (clock.rate.value = num) affects the rate of
    // all the tracks that share the rate parameter. If it is a simple
    // number, then it gets propagated by value - i.e. "clock.rate = num" in
    // one track won't change the rate for the other tracks.
    function rate(r) {
        return function (sched, clock, next) {
            clock.rate = r;
            next(sched, clock, stop);
        };
    }

    // A dynamic model that randomly chooses one from the given array of models
    // every time it is played.
    function choice(models) {
        return dynamic(function () {
            return models[Math.floor(Math.random() * models.length)];
        });
    }

    // Simple synchronization facility. You make a sync action and use it
    // in your composition. Keep a reference around to it and call its
    // `.play` with a model that has to be started when the sync point is
    // hit. Multiple models played will all be `spawn`ed.
    function sync(N) {
        if (arguments.length > 0) {
            // If N is given, make that many syncs.
            return (function (i, N, syncs) {
                for (; i < N; ++i) {
                    syncs.push(sync());
                }
                return syncs;
            }(0, N, []));
        }

        var models = [];

        function syncModel(sched, clock, next) {
            var i, N, actions;
            if (models.length > 0) {
                actions = models;
                models = [];
                for (i = 0, N = actions.length; i < N; ++i) {
                    actions[i](sched, clock.copy(), stop);
                }
            } 

            next(sched, clock, stop);
        }

        syncModel.play = function (model) {
            models.push(model);
            return this;
        };

        syncModel.cancel = function () {
            models.splice(0, models.length);
            return this;
        };

        return syncModel;
    }

    // ### gate()
    //
    // Another synchronization option. You make a gate and use it at
    // various points. You can then close() and open() gate. A newly
    // created gate doesn't block by default. 
    //
    // You can use gate() as a primitive to implement context aware
    // pause/resume. You make a `gate()` instance `g` first and introduce
    // it at appropriate points in your composition where you can allow it
    // to pause/resume. You can then pause your composition by calling
    // `g.close()` and resume it by calling `g.open()`.
    //
    // Other methods of a gate include - 
    //  
    //  - g.toggle() 
    //  - g.isOpen property gives open status of gate.
    //  - g.cancel() discards all pending resume actions.
    //      
    function gate(N) {
        if (arguments.length > 0) {
            // If N is given, make that many gates.
            return (function (i, N, gates) {
                for (; i < N; ++i) {
                    gates.push(gate());
                }
                return gates;
            }(0, N, []));
        }

        var cache = [];
        var state_stack = [];
        var isOpen = true;

        function gateModel(sched, clock, next) {
            if (isOpen) {
                next(sched, clock, stop);
            } else {
                // Cache this and wait.
                cache.push({sched: sched, next: next, clock: clock});
            }
        }

        function release(clock) {
            var actions = cache;
            var i, N, a, t = time_secs();
            cache = [];
            for (i = 0, N = actions.length; i < N; ++i) {
                a = actions[i];
                a.next(a.sched, clock ? clock.copy() : a.clock.advanceTo(t), stop);
            }
        }

        gateModel.__defineGetter__('isOpen', function () { return isOpen; });
        gateModel.__defineSetter__('isOpen', function (v) {
            if (v) {
                gateModel.open();
            } else {
                gateModel.close();
            }
            return v;
        });

        gateModel.open = function (sched, clock, next) {
            isOpen = true;
            release(clock);
            if (next) {
                next(sched, clock, stop);
            }
        };

        gateModel.close = function (sched, clock, next) {
            isOpen = false;
            if (next) {
                next(sched, clock, stop);
            }
        };

        gateModel.toggle = function (sched, clock, next) {
            if (isOpen) {
                return gateModel.close(sched, clock, next);
            } else {
                return gateModel.open(sched, clock, next);
            }
        };

        gateModel.cancel = function (sched, clock, next) {
            cache.splice(0, cache.length);
            if (next) {
                next(sched, clock, stop);
            }
        };

        gateModel.push = function (sched, clock, next) {
            state_stack.push({isOpen: isOpen, cache: cache});
            cache = [];
            if (next) {
                next(sched, clock, stop);
            }
        };

        gateModel.pop = function (sched, clock, next) {
            var state = state_stack.pop();
            cache.push.apply(cache, state.cache);
            this.isOpen = state.isOpen;
            if (next) {
                next(sched, clock, stop);
            }
        };

        return gateModel;
    }

    function stats() {
        return {
            frame_jitter_ms: 0
        };
    }

    // One of the requests towards connecting steller's scheduler to a
    // score is that it would be good to have a way to convert an object
    // notation into a scheduler spec that can be played using sh.play().
    //
    // Towards this, I've now added a "specFromJSON" method to the scheduler
    // that does such a transformation. 
    //
    // specFromJSON accepts an object and parses its key-value associations to
    // determine which scheduler models to build. For example, if the
    // object is of the form {track: [m1, m2, ..]}, then a "track" model
    // is built and the sub-models m1, m2, .. are recursively parsed for 
    // similar object properties.
    //
    // An additional "vocabulary" structure can be passed to "specFromJSON" to
    // take care of keys that are not recognized using the scheduler's built-in
    // vocabulary. This "vocabulary" is an object whose keys constitute the
    // introduced vocabulary and whose values give functions that will be
    // called to produce scheduler models. These functions are wrapped with
    // some minimal metadata to indicate to specFromJSON how they should be
    // used.
    //
    // To specify a vocabulary item as a function, provide an object
    // value of the form {convertArgs: true, fn: theFunction}. The convertArgs
    // property of this wrapper object is to tell specFromJSON to first recursively
    // expand the arguments into models before passing them to the function.
    // It's can be false too, in which case the recursion won't be performed.
    //
    // Note that fromJSON accepts more than just valid JSON since arguments
    // to vocabulary can be non-JSON objects as well. The "JSON" is a indication
    // in the name as to the purpose of this function - which is to de-serialize
    // models.
    //
    // Within the vocabulary function, the object that is required to be
    // transformed is available as "this", so that additional key-value
    // arguments may be looked up.
    //
    // If you wish to indicate that a particular object should not be
    // parsed and should be passed through as is, wrap it in a quote
    // form using the "$" key like this - {$: anyObject}.
    //
    // Example:
    //  Here is a new vocabulary called "majchord" that will play a 
    //  major chord using the chime model, given a reference pitch number.
    //
    //  var ch = sh.models.chime().connect();
    //  var vocab = {
    //      majchord: {
    //          convertArgs: false, // No need to convert pitchNumber and duration arguments.
    //          fn: function (pitchNumber, duration) {
    //              return sh.track([
    //                  sh.spawn([
    //                      ch.play(pitchNumber),
    //                      ch.play(pitchNumber + 4),
    //                      ch.play(pitchNumber + 7)
    //                  ]),
    //                  sh.delay(duration)
    //              ]);
    //          }
    //      }
    //  };
    //  var majchord = sh.specFromJSON({track: [{majchord: [72, 1.0]}, {majchord: [74, 1.0]}]}, vocab);

    var sh_vocab = {
        delay:      {convertArgs: true, fn: delay},
        loop:       {convertArgs: true, fn: loop},
        loop_while: {convertArgs: true, fn: loop_while},
        repeat:     {convertArgs: true, fn: repeat},
        fork:       {convertArgs: true, fn: fork},
        spawn:      {convertArgs: true, fn: spawn},
        track:      {convertArgs: true, fn: track},
        anim:       {convertArgs: true, fn: anim},
        rate:       {convertArgs: true, fn: rate},
        choice:     {convertArgs: true, fn: choice}
    };

    function specFromJSON(json, vocab) {
        if (!json || json.constructor !== Object) {
            return json;
        }

        // Get first key in object. Note that the object can
        // have multiple keys and (afaik) all Javascript engines
        // respect the order in which keys were inserted when
        // enumerating keys.
        var key = null;
        for (key in json) { break; }

        // Since modelFromJSON recursively transforms all
        // objects, treating everyone as a scheduler model
        // specifier, we need a way to tell the parser
        // "don't touch this". You can pass through any
        // value untouched by wrapping it into a quote
        // form which looks like {$: anyObject}.
        if (key === '$') {
            return json.$;
        }

        var impl = (vocab && vocab[key]) || sh_vocab[key];
        if (!impl) { throw new Error('Unknown vocabulary : ' + key); }

        var args = json[key], keys;
        if (args.constructor === Array) {
            // Recursively process all JSON object forms.
            if (impl.convertArgs) {
                args = args.map(function (arg) { return specFromJSON(arg, vocab); });
            }
        } else if (args.constructor === Object) {
            args = [impl.convertArgs ? fromJSON(args, vocab) : args];
        } else {
            args = [args]; // Solo argument.
        }

        // The vocabulary spec is expected to be a function that can be applied with the
        // json as the "this" and the arguments array as normal function arguments.

        if (impl.fn) {
            return impl.fn.apply(json, args);
        }

        throw new Error('Bad vocabulary specification');
    }

    self.audioContext   = audioContext;
    self.update         = scheduleUpdate;
    self.perform        = perform;
    self.cancel         = cancel;
    self.play           = play;
    self.stop           = stop;
    self.cont           = cont;
    self.delay          = delay;
    self.loop           = loop;
    self.loop_while     = loop_while;
    self.repeat         = repeat;
    self.fork           = fork;
    self.spawn          = spawn;
    self.dynamic        = dynamic;
    self.track          = track;
    self.slice          = slice;
    self.fire           = fire;
    self.display        = display;
    self.frame          = frame;
    self.frames         = frames;
    self.log            = log;
    self.anim           = anim;
    self.rate           = rate;
    self.choice         = choice;
    self.sync           = sync;
    self.gate           = gate;
    self.stats          = stats;
    self.specFromJSON   = specFromJSON;

    // Start the scheduler by default. I decided to do this because
    // so far on many occasions I've spent considerable time in 
    // debugging an unexpected outcome simply because I forgot to
    // start the scheduler. Shows I have an expectation that once
    // a "new Scheduler" is created, it is expected to be up and
    // running. Hence this choice of a default. If you really
    // need it to be quiet upon start, provide an "options.running = false"
    // in the second argument.
    self.running = (options && ('running' in options) && options.running) || true;

    // If the Models collection is available, instantiate it for
    // this scheduler so that the user won't have to bother doing that
    // separately.         
    try {
        Scheduler.Models(self);
    } catch (e) {
        console.log(e);
    }

    return self;
};

module.exports = Scheduler;
