GZIPENC = --add-header="Content-Encoding: gzip"
HTMLCONTENT = --mime-type="text/html"
JSCONTENT = --mime-type="application/javascript"
CACHE2W = --add-header="Cache-Control: max-age=1209600"
CACHE1D = --add-header="Cache-Control: max-age=86400"
CACHE1W = --add-header="Cache-Control: max-age=604800"

steller.min.js.gz : steller.min.js
	gzip --stdout steller.min.js > steller.min.js.gz

steller.min.js : steller.js
	cljs --compilation_level=SIMPLE_OPTIMIZATIONS steller.js > steller.min.js

steller.js : src/steller.js src/steller/*.js src/steller/models/*.js
	cd src && r.js -o optimize=none name=steller out=../steller.js
	
deploy : steller.min.js.gz
	which s3cmd && s3cmd $(GZIPENC) $(JSCONTENT) $(CACHE1W) -P put steller.min.js.gz "s3://sriku.org/lib/steller/steller_amd.min.js"
	
clean : 
	rm steller.min.js steller.min.js.gz

release : steller.min.js
	mv steller.min.js _steller.min.js
	git checkout release
	mv _steller.min.js steller.min.js
	git add steller.min.js
	git commit
