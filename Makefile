GZIPENC = --add-header="Content-Encoding: gzip"
HTMLCONTENT = --mime-type="text/html"
JSCONTENT = --mime-type="application/javascript"
CACHE2W = --add-header="Cache-Control: max-age=1209600"
CACHE1D = --add-header="Cache-Control: max-age=86400"
CACHE1W = --add-header="Cache-Control: max-age=604800"
CURRVER = $(shell git describe --tags)
browserify = node_modules/.bin/browserify
uglifyjs = node_modules/.bin/uglifyjs

steller.min.js.gz : steller.min.js
	gzip --stdout steller.min.js > steller.min.js.gz

steller.min.js : steller.js
	$(uglifyjs) -o steller.min.js steller.js

steller.js : src/steller.js src/steller/*.js src/steller/models/*.js
	cd src && ../$(browserify) -s steller -o ../steller.js steller.js
	
deploy : steller.min.js.gz
	which s3cmd && s3cmd $(GZIPENC) $(JSCONTENT) $(CACHE1W) -P put steller.min.js.gz "s3://sriku.org/lib/steller/steller_$(CURRVER).min.js"
	@echo http://sriku.org/lib/steller/steller_$(CURRVER).min.js
	
clean : 
	rm steller.js steller.min.js steller.min.js.gz
