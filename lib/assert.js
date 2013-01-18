// This may look like C code, but it is actually intended
// for Javascript code that is piped through the C preprocessor.
// The idea is that even minified JS code can report assert
// failures and logs with the source file name in the report.
// In principle, source maps ought to solve problems like this,
// but I haven't played with them very much yet.
//  - Kumar


#if DEBUG

var LOG_LEVEL = 4;

#define ASSERT(x,...) do { if (!(x)) { console.error(__FILE__ + '[' + __LINE__ + ']:\tASSERT failed (' + #x + ') ', ##__VA_ARGS__); debugger; } } while (false)
#define WARNIF(cond,...) do { if (cond) { console.warning(__FILE__ + '[' + __LINE__ + ']:\tWARNING!\t' + #cond); } } while (false)
#define REQUIRE(x,...) do { if (!(x)) { debugger; throw new Error(__FILE__ + '[' + __LINE__ + ']:\t' + #x); } } while (false)
#define ERROR(...) do { console.error(__FILE__ + '[' + __LINE__ + ']:\t', ##__VA_ARGS__); } while (0)

#else // Kill them all in the "release" build.

var LOG_LEVEL = 1;

#define ASSERT(...)
#define WARNIF(...)
#define REQUIRE(...)
#define ERROR(...)

#endif

#define LOG(level, ...) do { if (level < LOG_LEVEL) { console.log(__FILE__ + '[' + __LINE__ + ']:\t', ##__VA_ARGS__); } } while (false)

