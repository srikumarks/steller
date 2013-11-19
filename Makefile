CPP=gcc -E -x c -DDEBUG=0${DEBUG} -P -undef -Wundef -std=c99 -nostdinc -Wtrigraphs -fdollars-in-identifiers

steller.min.js.gz : steller.min.js
	gzip --stdout steller.min.js > steller.min.js.gz

steller.min.js : src/*.js src/models/*.js
	cd src && r.js -o name=steller out=../steller.min.js
	
clean : 
	rm steller.min.js steller.min.js.gz

release : steller.min.js
	mv steller.min.js _steller.min.js
	git checkout release
	mv _steller.min.js steller.min.js
	git add steller.min.js
	git commit
