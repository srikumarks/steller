define(["./param"], function (Param) {
    var UI = {};

    function round(n) {
        var m = n % 1;
        var f = n - m;
        var k = Math.pow(10, 4 - Math.min(3, ('' + f).length));
        return Math.round(n * k) / k;
    }

    function mappingFn(mapping) {
        if (typeof(mapping) === 'string') {
            return Param.mappings[mapping];
        } else {
            return mapping || Param.mappings.linear;
        }
    }

    function insertBeforeEnd(target) {
        return function (e) {
            target.insertAdjacentElement('beforeend', e);
        };
    }

    // Makes a simple UI with sliders for the parameters exposed by the model.
    // The return value is a div element that can be inserted into some DOM part.
    // This element is also stored in "model.ui" for reuse. If one already exists,
    // a new one is not created.
    UI.basicUI = function (document, model, sectionLabel) {
        if (model.ui) {
            return model.ui;
        }

        var div = document.createElement('div');
        if (sectionLabel) {
            div.insertAdjacentHTML('beforeend', '<p><b>' + sectionLabel + '</b></p>');
        }

        var specs = Param.names(model).map(function (k) {
            var spec = Object.create(model[k].spec);
            spec.name = spec.name || k;
            spec.param = model[k];
            return spec;
        });

        specs.forEach(function (spec) {
            var paramName = spec.name;
            var param = spec.param;

            if ('min' in spec && 'max' in spec) {
                // Only expose numeric parameters for the moment.
                var cont = document.createElement('div');
                var label = document.createElement('span');
                var valueDisp = document.createElement('span');
                label.innerText = (spec.label || paramName) + ': ';
                label.style.width = '100px';
                label.style.display = 'inline-block';
                label.style.textAlign = 'left';

                var slider = document.createElement('input');
                slider.type = 'range';
                slider.min = 0.0;
                slider.max = 1.0;
                slider.step = 0.001;

                var mapping = mappingFn(spec.mapping);
                var units = spec.units ? ' ' + spec.units : '';

                slider.value = mapping.toNorm(param);
                valueDisp.innerText = ' (' + round(param.value) + units + ')';

                slider.changeModelParameter = function (e) {
                    // Slider value changed. So change the model parameter.
                    // Use curve() to map the [0,1] range of the slider to
                    // the parameter's range.
                    param.value = mapping.fromNorm(param, parseFloat(this.value));
                };

                slider.changeSliderValue = function (value) {
                    // Model value changed. So change the slider. Use curve()
                    // to map the parameter value to the slider's [0,1] range.
                    slider.value = mapping.toNorm(param);
                    valueDisp.innerText = ' (' + round(value) + units + ')';
                };

                slider.addEventListener('input', slider.changeModelParameter);
                param.watch(slider.changeSliderValue);

                [label, slider, valueDisp].forEach(insertBeforeEnd(cont));
                div.insertAdjacentElement('beforeend', cont);
            }
        });

        return (model.ui = div);
    };

    return UI;
});


