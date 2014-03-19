module.exports = function installer(S, sh) {
    var AC = sh.audioContext;

    // A simple wrapper to get a decoded buffer.
    var sampleCache = {};
    function sampleKey(url) { return 'sound:' + url; }

    var load_sample = function (url, callback, errback) {
        var key = sampleKey(url);
        var buff = sampleCache[key];
        if (buff) {
            if (callback) {
                callback(buff);
            }
            return buff;
        } else if (callback) {
            var xhr = new XMLHttpRequest();

            xhr.open('GET', url, true);
            xhr.responseType = 'arraybuffer';
            xhr.onerror = function (e) {

                ERROR(e);
                if (errback) {
                    errback(e, url);
                }
            };
            xhr.onload = function () {
                AC.decodeAudioData(xhr.response, 
                        function (buff) {
                            callback(sampleCache[key] = buff);
                            LOG(0, "Sound [" + url + "] loaded!");
                        },
                        function (err) {
                            ERROR("Sound [" + url + "] failed to decode.");
                            if (errback) {
                                errback(err, url);
                            }
                        });
            };
            xhr.send();
        }
        return undefined;
    };

    // Clears the sample cache to release resources.
    load_sample.clearCache = function () {
        sampleCache = {};
    };

    return load_sample;
};

       
